import org.bytedeco.llvm.LLVM.LLVMBasicBlockRef;
import org.bytedeco.llvm.LLVM.LLVMValueRef;
import org.llvm4j.llvm4j.Module;

import java.util.*;

import static org.bytedeco.llvm.global.LLVM.*;

public class IROptimizer {
	public static void optimize(Module module) {
		boolean changed;
		do {
			changed = constantPropagationPass(module);
			if (eliminateDeadCodePass(module)) changed = true;
			if (eliminateUnusedVarsPass(module)) changed = true;
		} while (changed);
	}

	// Part1: 常量传播（数据流分析worklist算法实现）
	private static boolean constantPropagationPass(Module module) {
		boolean changed = false;
		// 1. 收集只赋值一次的全局常量
		Map<String, Integer> globalConst = new HashMap<>();
		Map<String, Integer> globalAssignCount = new HashMap<>();
		for (LLVMValueRef global = LLVMGetFirstGlobal(module.getRef()); global != null; global = LLVMGetNextGlobal(global)) {
			String name = LLVMGetValueName(global).getString();
			LLVMValueRef init = LLVMGetInitializer(global);
			if (LLVMIsAConstantInt(init) != null) {
				int val = (int) LLVMConstIntGetSExtValue(init);
				globalConst.put(name, val);
			}
			globalAssignCount.put(name, 0);
		}
		// 2. 遍历所有函数
		for (LLVMValueRef func = LLVMGetFirstFunction(module.getRef()); func != null; func = LLVMGetNextFunction(func)) {
			if (LLVMGetFirstBasicBlock(func) == null) continue;

			// --- 构建CFG ---
			List<LLVMBasicBlockRef> blocks = new ArrayList<>();
			Map<LLVMBasicBlockRef, List<LLVMBasicBlockRef>> preds = new HashMap<>();
			Map<LLVMBasicBlockRef, List<LLVMBasicBlockRef>> succs = new HashMap<>();
			for (LLVMBasicBlockRef bb = LLVMGetFirstBasicBlock(func); bb != null; bb = LLVMGetNextBasicBlock(bb)) {
				blocks.add(bb);
				preds.put(bb, new ArrayList<>());
				succs.put(bb, new ArrayList<>());
			}
			// 填充succs和preds
			for (LLVMBasicBlockRef bb : blocks) {
				LLVMValueRef term = LLVMGetBasicBlockTerminator(bb);
				if (term == null) continue;
				int opcode = LLVMGetInstructionOpcode(term);
				if (opcode == LLVMBr) {
					int n = LLVMGetNumOperands(term);
					if (n == 1) {
						LLVMBasicBlockRef target = LLVMValueAsBasicBlock(LLVMGetOperand(term, 0));
						if (target != null) {
							succs.get(bb).add(target);
							preds.get(target).add(bb);
						}
					} else if (n == 3) {
						LLVMBasicBlockRef tbb = LLVMValueAsBasicBlock(LLVMGetOperand(term, 2));
						LLVMBasicBlockRef fbb = LLVMValueAsBasicBlock(LLVMGetOperand(term, 1));
						if (tbb != null) {
							succs.get(bb).add(tbb);
							preds.get(tbb).add(bb);
						}
						if (fbb != null) {
							succs.get(bb).add(fbb);
							preds.get(fbb).add(bb);
						}
					}
				}
			}

			// --- 数据流分析初始化 ---
			final Object UNDEF = new Object();
			final Object NAC = new Object();
			Map<LLVMBasicBlockRef, Map<String, Object>> in = new HashMap<>();
			Map<LLVMBasicBlockRef, Map<String, Object>> out = new HashMap<>();
			for (LLVMBasicBlockRef bb : blocks) {
				in.put(bb, new HashMap<>());
				out.put(bb, new HashMap<>());
			}
			// 所有变量初始为UNDEF
			Set<String> allVars = new HashSet<>();
			for (LLVMBasicBlockRef bb : blocks) {
				for (LLVMValueRef inst = LLVMGetFirstInstruction(bb); inst != null; inst = LLVMGetNextInstruction(inst)) {
					int opcode = LLVMGetInstructionOpcode(inst);
					if (opcode == LLVMStore) {
						LLVMValueRef ptr = LLVMGetOperand(inst, 1);
						String varName = LLVMGetValueName(ptr).getString();
						if (varName != null && !varName.isEmpty()) {
							allVars.add(varName);
							if (globalAssignCount.containsKey(varName)) {
								globalAssignCount.put(varName, globalAssignCount.get(varName) + 1);
							}
						}
					}
				}
			}
			for (LLVMBasicBlockRef bb : blocks) {
				for (String v : allVars) {
					in.get(bb).put(v, UNDEF);
					out.get(bb).put(v, UNDEF);
				}
			}

			// --- worklist算法 ---
			Queue<LLVMBasicBlockRef> worklist = new LinkedList<>(blocks);
			while (!worklist.isEmpty()) {
				LLVMBasicBlockRef B = worklist.poll();
				Map<String, Object> oldOut = new HashMap<>(out.get(B));
				// meet: in[B] = meet{ out[P] | P ∈ preds[B] }
				Map<String, Object> meetVals = new HashMap<>();
				for (String v : allVars) {
					Object val = null;
					boolean first = true;
					for (LLVMBasicBlockRef P : preds.get(B)) {
						Object pval = out.get(P).get(v);
						if (first) {
							val = pval;
							first = false;
						} else {
							if (Objects.equals(val, pval)) {
								// do nothing
							} else if (val == UNDEF) {
								val = pval;
							} else if (pval == UNDEF) {
								// val unchanged
							} else {
								val = NAC;
							}
						}
					}
					if (val == null) val = UNDEF;
					meetVals.put(v, val);
				}
				in.put(B, meetVals);
				// transfer: out[B] = transfer(B, in[B])
				Map<String, Object> vals = new HashMap<>(meetVals);
				for (LLVMValueRef inst = LLVMGetFirstInstruction(B); inst != null; inst = LLVMGetNextInstruction(inst)) {
					int opcode = LLVMGetInstructionOpcode(inst);
					if (opcode == LLVMStore) {
						LLVMValueRef valOp = LLVMGetOperand(inst, 0);
						LLVMValueRef ptr = LLVMGetOperand(inst, 1);
						String v = LLVMGetValueName(ptr).getString();
						if (v == null || v.isEmpty()) continue;
						if (LLVMIsAConstantInt(valOp) != null) {
							int c = (int) LLVMConstIntGetSExtValue(valOp);
							vals.put(v, c);
						} else {
							vals.put(v, NAC);
						}
					} else if (opcode == LLVMAdd || opcode == LLVMSub || opcode == LLVMMul || opcode == LLVMSDiv || opcode == LLVMSRem) {
						LLVMValueRef lhs = LLVMGetOperand(inst, 0);
						LLVMValueRef rhs = LLVMGetOperand(inst, 1);
						String v = LLVMGetValueName(inst).getString();
						Object vx = null, vy = null;
						if (lhs != null && LLVMIsAConstantInt(lhs) != null) {
							vx = (int) LLVMConstIntGetSExtValue(lhs);
						} else if (lhs != null) {
							String name = LLVMGetValueName(lhs).getString();
							vx = vals.getOrDefault(name, UNDEF);
						}
						if (rhs != null && LLVMIsAConstantInt(rhs) != null) {
							vy = (int) LLVMConstIntGetSExtValue(rhs);
						} else if (rhs != null) {
							String name = LLVMGetValueName(rhs).getString();
							vy = vals.getOrDefault(name, UNDEF);
						}
						if (vx instanceof Integer && vy instanceof Integer) {
							int res = 0;
							switch (opcode) {
								case LLVMAdd: res = (int)vx + (int)vy; break;
								case LLVMSub: res = (int)vx - (int)vy; break;
								case LLVMMul: res = (int)vx * (int)vy; break;
								case LLVMSDiv: res = (int)vx / (int)vy; break;
								case LLVMSRem: res = (int)vx % (int)vy; break;
							}
							vals.put(v, res);
						} else if (vx == NAC || vy == NAC) {
							vals.put(v, NAC);
						} else {
							vals.put(v, UNDEF);
						}
					}
				}
				if (!vals.equals(oldOut)) {
					out.put(B, vals);
					for (LLVMBasicBlockRef succ : succs.get(B)) {
						if (!worklist.contains(succ)) worklist.add(succ);
					}
				}
			}

			// --- 替换常量 ---
			for (LLVMBasicBlockRef bb : blocks) {
				Map<String, Object> outVals = out.get(bb);
				for (LLVMValueRef inst = LLVMGetFirstInstruction(bb); inst != null; ) {
					LLVMValueRef nextInst = LLVMGetNextInstruction(inst);
					int opcode = LLVMGetInstructionOpcode(inst);
					if (opcode == LLVMStore) {
						LLVMValueRef ptr = LLVMGetOperand(inst, 1);
						String varName = LLVMGetValueName(ptr).getString();
						if (varName != null && outVals.get(varName) instanceof Integer) {
							int c = (int) outVals.get(varName);
							LLVMValueRef constVal = LLVMConstInt(LLVMTypeOf(ptr), c, 1);
							LLVMReplaceAllUsesWith(ptr, constVal);
							LLVMInstructionEraseFromParent(inst);
							changed = true;
						}
					}
					inst = nextInst;
				}
			}
		}
		return changed;
	}

	// Part2: 未使用变量消除
	private static boolean eliminateUnusedVarsPass(Module module) {
		boolean changed = false;
		for (LLVMValueRef func = LLVMGetFirstFunction(module.getRef()); func != null; func = LLVMGetNextFunction(func)) {
			if (LLVMGetFirstBasicBlock(func) == null) continue;
			// 统计定义和使用次数
			Map<String, Integer> defCount = new HashMap<>();
			Map<String, Integer> useCount = new HashMap<>();
			Map<String, LLVMValueRef> defInst = new HashMap<>();
			List<LLVMValueRef> allInsts = new ArrayList<>();
			for (LLVMBasicBlockRef bb = LLVMGetFirstBasicBlock(func); bb != null; bb = LLVMGetNextBasicBlock(bb)) {
				for (LLVMValueRef inst = LLVMGetFirstInstruction(bb); inst != null; inst = LLVMGetNextInstruction(inst)) {
					allInsts.add(inst);
					int opcode = LLVMGetInstructionOpcode(inst);
					String defName = LLVMGetValueName(inst).getString();
					// 记录定义
					if (opcode == LLVMAlloca || opcode == LLVMLoad || opcode == LLVMAdd || opcode == LLVMSub || opcode == LLVMMul || opcode == LLVMSDiv || opcode == LLVMSRem) {
						if (defName != null && !defName.isEmpty()) {
							defCount.put(defName, defCount.getOrDefault(defName, 0) + 1);
							defInst.put(defName, inst);
						}
					}
					// 统计使用
					int n = LLVMGetNumOperands(inst);
					for (int i = 0; i < n; i++) {
						LLVMValueRef op = LLVMGetOperand(inst, i);
						String useName = LLVMGetValueName(op).getString();
						if (useName != null && !useName.isEmpty()) {
							useCount.put(useName, useCount.getOrDefault(useName, 0) + 1);
						}
					}
				}
			}
			// 找到未被使用的局部变量（只定义未被使用，且不是全局变量）
			Set<String> unused = new HashSet<>();
			for (String name : defCount.keySet()) {
				if (!useCount.containsKey(name)) {
					unused.add(name);
				}
			}
			// 删除相关指令
			for (LLVMValueRef inst : allInsts) {
				int opcode = LLVMGetInstructionOpcode(inst);
				String defName = LLVMGetValueName(inst).getString();
				// 删除alloca、load、二元运算等定义未被使用的变量的指令
				if (defName != null && unused.contains(defName)) {
					LLVMInstructionEraseFromParent(inst);
					changed = true;
				}
				// 删除store到未被使用变量的指令
				if (opcode == LLVMStore) {
					LLVMValueRef ptr = LLVMGetOperand(inst, 1);
					String varName = LLVMGetValueName(ptr).getString();
					if (varName != null && unused.contains(varName)) {
						LLVMInstructionEraseFromParent(inst);
						changed = true;
					}
				}
			}
		}
		return changed;
	}

	// Part3: 死代码消除
	private static boolean eliminateDeadCodePass(Module module) {
		boolean changed = false;
		for (LLVMValueRef func = LLVMGetFirstFunction(module.getRef()); func != null; func = LLVMGetNextFunction(func)) {
			if (LLVMGetFirstBasicBlock(func) == null) continue;
			// 1. 标记所有可达基本块
			Set<LLVMBasicBlockRef> reachable = new HashSet<>();
			Queue<LLVMBasicBlockRef> queue = new LinkedList<>();
			LLVMBasicBlockRef entry = LLVMGetFirstBasicBlock(func);
			if (entry == null) continue;
			queue.add(entry);
			reachable.add(entry);
			while (!queue.isEmpty()) {
				LLVMBasicBlockRef bb = queue.poll();
				LLVMValueRef term = LLVMGetBasicBlockTerminator(bb);
				if (term == null) continue;
				int opcode = LLVMGetInstructionOpcode(term);
				if (opcode == LLVMBr) {
					int n = LLVMGetNumOperands(term);
					if (n == 1) { // 无条件跳转
						LLVMBasicBlockRef target = LLVMValueAsBasicBlock(LLVMGetOperand(term, 0));
						if (target != null && !reachable.contains(target)) {
							reachable.add(target);
							queue.add(target);
						}
					} else if (n == 3) { // 条件跳转
						LLVMValueRef cond = LLVMGetOperand(term, 0);
						LLVMBasicBlockRef tbb = LLVMValueAsBasicBlock(LLVMGetOperand(term, 2));
						LLVMBasicBlockRef fbb = LLVMValueAsBasicBlock(LLVMGetOperand(term, 1));
						// 如果cond是常量，只有一条分支可达
						if (LLVMIsAConstantInt(cond) != null) {
							int c = (int) LLVMConstIntGetSExtValue(cond);
							LLVMBasicBlockRef only = (c != 0) ? tbb : fbb;
							if (only != null && !reachable.contains(only)) {
								reachable.add(only);
								queue.add(only);
							}
						} else {
							if (tbb != null && !reachable.contains(tbb)) {
								reachable.add(tbb);
								queue.add(tbb);
							}
							if (fbb != null && !reachable.contains(fbb)) {
								reachable.add(fbb);
								queue.add(fbb);
							}
						}
					}
				}
			}
			// 2. 删除不可达基本块
			List<LLVMBasicBlockRef> toDelete = new ArrayList<>();
			for (LLVMBasicBlockRef bb = LLVMGetFirstBasicBlock(func); bb != null; ) {
				LLVMBasicBlockRef next = LLVMGetNextBasicBlock(bb);
				if (!reachable.contains(bb)) {
					LLVMRemoveBasicBlockFromParent(bb);
					changed = true;
				}
				bb = next;
			}
			// 3. 利用常量条件简化分支指令
			for (LLVMBasicBlockRef bb = LLVMGetFirstBasicBlock(func); bb != null; bb = LLVMGetNextBasicBlock(bb)) {
				LLVMValueRef term = LLVMGetBasicBlockTerminator(bb);
				if (term == null) continue;
				int opcode = LLVMGetInstructionOpcode(term);
				if (opcode == LLVMBr && LLVMGetNumOperands(term) == 3) {
					LLVMValueRef cond = LLVMGetOperand(term, 0);
					if (LLVMIsAConstantInt(cond) != null) {
						int c = (int) LLVMConstIntGetSExtValue(cond);
						LLVMBasicBlockRef target = (c != 0) ? LLVMValueAsBasicBlock(LLVMGetOperand(term, 2)) : LLVMValueAsBasicBlock(LLVMGetOperand(term, 1));
						// 直接删除原条件跳转，冗余跳转由后续优化清理
						LLVMInstructionEraseFromParent(term);
						changed = true;
					}
				}
			}
			// 4. 冗余跳转指令清理（如连续无条件跳转等）
			// 可选：此处可进一步优化
			// --- 冗余跳转清理 ---
			// 1. 删除跳转到下一个顺序块的无用跳转
			List<LLVMBasicBlockRef> blocks = new ArrayList<>();
			for (LLVMBasicBlockRef bb = LLVMGetFirstBasicBlock(func); bb != null; bb = LLVMGetNextBasicBlock(bb)) {
				blocks.add(bb);
			}
			for (int i = 0; i < blocks.size() - 1; i++) {
				LLVMBasicBlockRef bb = blocks.get(i);
				LLVMBasicBlockRef next = blocks.get(i + 1);
				LLVMValueRef term = LLVMGetBasicBlockTerminator(bb);
				if (term != null && LLVMGetInstructionOpcode(term) == LLVMBr && LLVMGetNumOperands(term) == 1) {
					LLVMBasicBlockRef target = LLVMValueAsBasicBlock(LLVMGetOperand(term, 0));
					if (target == next) {
						LLVMInstructionEraseFromParent(term);
						changed = true;
					}
				}
			}
			// 2. 删除只包含一个无条件跳转的空块（非入口块）
			for (int i = 1; i < blocks.size(); i++) {
				LLVMBasicBlockRef bb = blocks.get(i);
				LLVMValueRef inst = LLVMGetFirstInstruction(bb);
				if (inst != null && LLVMGetNextInstruction(inst) == null && LLVMGetInstructionOpcode(inst) == LLVMBr) {
					// 只包含一个无条件跳转
					LLVMRemoveBasicBlockFromParent(bb);
					changed = true;
				}
			}
		}
		return changed;
	}
}