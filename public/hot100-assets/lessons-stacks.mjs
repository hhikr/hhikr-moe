import {lesson,array,text} from './lesson-kit.mjs';
export const stackLessons={
20:lesson({id:20,signature:'public boolean isValid(String s)',sample:{s:'([]){}'},expected:true,call:'new Solution().isValid("([]){}")',description:'字符串只包含 ()、[]、{}。判断每个右括号是否由同类型的左括号正确匹配，且嵌套顺序正确。',idea:'遇到左括号时，把它期望的右括号入栈；遇到右括号时，检查它是否等于栈顶。最后栈必须为空。',invariant:'栈从底到顶保存当前尚未关闭的括号所期望的右括号。',time:'O(n)',space:'O(n)',mode:'string',valueLabel:'括号 / s',stateLabel:'期望的右括号 / stack'},`class Solution {
    public boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>(); // @init
        for (char c : s.toCharArray()) { // @loop
            if (c == '(') stack.push(')'); // @round
            else if (c == '[') stack.push(']'); // @square
            else if (c == '{') stack.push('}'); // @curly
            else if (stack.isEmpty() || stack.pop() != c) return false; // @match
        }
        return stack.isEmpty(); // @return
    }
}`,({s},emit)=>{text(s);if(!/^[()[\]{}]*$/.test(s))throw Error('s 只能包含六种括号字符');const v=[...s],stack=[],memory=()=>stack.map((c,i)=>[i,c]);emit('init',v,[],'创建空栈。');for(let i=0;i<s.length;i++){const c=s[i];emit('loop',v,[i],'读取下一个括号。',{i,c},memory());if(c==='('){stack.push(')');emit('round',v,[i],'期待之后出现右圆括号，入栈。',{i,c},memory());}else if(c==='['){stack.push(']');emit('square',v,[i],'期待之后出现右方括号，入栈。',{i,c},memory());}else if(c==='{'){stack.push('}');emit('curly',v,[i],'期待之后出现右花括号，入栈。',{i,c},memory());}else{const expected=stack.pop();const ok=expected===c;emit('match',v,[i],ok?'右括号与栈顶期待一致，完成一对。':'栈为空或类型不匹配，立即返回 false。',{i,c,expected:expected??'空'},memory());if(!ok)return false;}}const valid=stack.length===0;emit('return',v,[],valid?'所有括号都已匹配。':'还有未关闭的左括号。',{valid},memory());return valid;}),
739:lesson({id:739,signature:'public int[] dailyTemperatures(int[] temperatures)',sample:{temperatures:[73,74,75,71,69,72,76,73]},expected:[1,1,4,2,1,1,0,0],call:'new Solution().dailyTemperatures(new int[]{73,74,75,71,69,72,76,73})',print:'System.out.println(Arrays.toString(new Solution().dailyTemperatures(new int[]{73,74,75,71,69,72,76,73})));',description:'对每天的温度，求还要等待多少天才会遇到更高的温度。之后没有更高温度时填 0。',idea:'单调栈保存尚未找到更暖天的下标，温度从栈底到栈顶非递增。新温度更高时，依次弹出栈顶并计算等待天数。',invariant:'栈中下标还没有答案；每个下标只入栈和出栈各一次。',time:'O(n)',space:'O(n)',valueLabel:'温度 / temperatures',stateLabel:'尚未匹配 / 下标 → 温度'},`class Solution {
    public int[] dailyTemperatures(int[] temperatures) {
        int[] ans = new int[temperatures.length]; // @init
        Deque<Integer> stack = new ArrayDeque<>(); // @stack
        for (int i = 0; i < temperatures.length; i++) { // @loop
            while (!stack.isEmpty() && temperatures[i] > temperatures[stack.peek()]) { // @warmer
                int previous = stack.pop(); // @pop
                ans[previous] = i - previous; // @answer
            }
            stack.push(i); // @push
        }
        return ans; // @return
    }
}`,({temperatures},emit)=>{const a=array(temperatures,'temperatures'),ans=Array(a.length).fill(0),stack=[];const memory=()=>stack.map(i=>[i,a[i]]);emit('init',a,[],'等待天数默认是 0。',{answer:JSON.stringify(ans)});emit('stack',a,[],'创建单调栈。');for(let i=0;i<a.length;i++){emit('loop',a,[i],'读取新一天的温度。',{i,answer:JSON.stringify(ans)},memory());while(stack.length&&a[i]>a[stack.at(-1)]){emit('warmer',a,[i,stack.at(-1)],'新温度高于栈顶，可以确定栈顶的答案。',{i},memory());const previous=stack.pop();emit('pop',a,[previous,i],'弹出已找到更暖天的下标。',{i,previous},memory());ans[previous]=i-previous;emit('answer',a,[previous,i],`第 ${previous} 天需要等待 ${i-previous} 天。`,{i,previous,answer:JSON.stringify(ans)},memory());}stack.push(i);emit('push',a,[i],'今天暂未找到更暖天，加入栈。',{i,answer:JSON.stringify(ans)},memory());}emit('return',a,[],`返回 ${JSON.stringify(ans)}。`,{answer:JSON.stringify(ans)},memory());return ans;}),
84:lesson({id:84,signature:'public int largestRectangleArea(int[] heights)',sample:{heights:[2,1,5,6,2,3]},expected:10,call:'new Solution().largestRectangleArea(new int[]{2,1,5,6,2,3})',description:'柱子宽度均为 1，高度由非负数组给出。求柱状图中能够覆盖的最大矩形面积。',idea:'递增栈保存还未找到右侧更矮柱子的下标。遇到更矮柱子时，弹出的柱子可以确定左右边界，面积等于高度乘可延伸宽度。末尾补一个零高度哨兵清空栈。',invariant:'栈内高度严格递增；弹出时右边界已确定，新的栈顶是左侧边界。',time:'O(n)',space:'O(n)',valueLabel:'柱子高度 / heights',stateLabel:'递增栈 / 下标 → 高度'},`class Solution {
    public int largestRectangleArea(int[] heights) {
        Deque<Integer> stack = new ArrayDeque<>(); // @init
        int best = 0; // @best-init
        for (int i = 0; i <= heights.length; i++) { // @loop
            int current = i == heights.length ? 0 : heights[i]; // @height
            while (!stack.isEmpty() && heights[stack.peek()] >= current) { // @shorter
                int index = stack.pop(); // @pop
                int left = stack.isEmpty() ? -1 : stack.peek(); // @left
                int width = i - left - 1; // @width
                best = Math.max(best, heights[index] * width); // @area
            }
            stack.push(i); // @push
        }
        return best; // @return
    }
}`,({heights},emit)=>{const a=array(heights,'heights',{positive:true}),v=[...a,0],stack=[];let best=0;const memory=()=>stack.map(i=>[i,v[i]]);emit('init',v,[],'创建递增栈，最后一个 0 是清栈哨兵。');emit('best-init',v,[],'最大面积从 0 开始。',{best});for(let i=0;i<=a.length;i++){emit('loop',v,[i],'扫描下一根柱子。',{i,best},memory());const current=i===a.length?0:a[i];emit('height',v,[i],i===a.length?'到达哨兵，结算所有剩余柱子。':`当前高度为 ${current}。`,{i,current,best},memory());while(stack.length&&a[stack.at(-1)]>=current){emit('shorter',v,[i,stack.at(-1)],'遇到更矮或同高柱子，可以结算栈顶。',{i,current,best},memory());const index=stack.pop();emit('pop',v,[index],'取出要结算的柱子。',{i,index,best},memory());const left=stack.length?stack.at(-1):-1;emit('left',v,left>=0?[left,index]:[index],'新的栈顶给出左侧边界。',{i,index,left,best},memory());const width=i-left-1;emit('width',v,Array.from({length:width},(_,j)=>left+1+j),`可覆盖宽度 = ${i} − ${left} − 1 = ${width}。`,{i,index,left,width,best},memory());best=Math.max(best,a[index]*width);emit('area',v,[index],`面积 ${a[index]} × ${width}，更新最大值。`,{i,index,width,best},memory());}stack.push(i);emit('push',v,[i],'当前柱子入栈。',{i,current,best},memory());}emit('return',v,[],`最大矩形面积为 ${best}。`,{best},memory());return best;}),
394:lesson({id:394,signature:'public String decodeString(String s)',sample:{s:'3[a2[c]]'},expected:'accaccacc',call:'new Solution().decodeString("3[a2[c]]")',description:'解码 k[内容] 形式的字符串，方括号可以嵌套；k 是正整数，普通内容由英文字母组成。',idea:'进入左括号时，把外层字符串和重复次数入栈，并开始收集内层内容。遇到右括号时，弹出外层状态，把内层字符串重复指定次数再拼接。',invariant:'current 保存当前括号层的已解码内容；栈保存每一层尚未完成的外部状态。',time:'O(解码结果长度 × 嵌套深度)，此 StringBuilder 写法',space:'O(解码结果长度 + 嵌套深度)',mode:'string',valueLabel:'编码字符 / s',stateLabel:'外层状态 / 重复次数 → 前缀'},`class Solution {
    public String decodeString(String s) {
        Deque<Integer> counts = new ArrayDeque<>(); // @counts
        Deque<StringBuilder> prefixes = new ArrayDeque<>(); // @prefixes
        StringBuilder current = new StringBuilder(); // @current
        int number = 0; // @number-init
        for (char c : s.toCharArray()) { // @loop
            if (Character.isDigit(c)) { // @digit
                number = number * 10 + c - '0'; // @number
            } else if (c == '[') { // @open
                counts.push(number); prefixes.push(current); // @save
                current = new StringBuilder(); number = 0; // @reset
            } else if (c == ']') { // @close
                StringBuilder parent = prefixes.pop(); // @parent
                int repeat = counts.pop(); // @repeat
                for (int i = 0; i < repeat; i++) parent.append(current); // @expand
                current = parent; // @restore
            } else current.append(c); // @append
        }
        return current.toString(); // @return
    }
}`,({s},emit)=>{text(s);if(!/^[a-zA-Z0-9[\]]*$/.test(s))throw Error('编码只允许英文字母、数字和方括号');const v=[...s],counts=[],prefixes=[];let current='',number=0;const memory=()=>counts.map((n,i)=>[n,prefixes[i]]),vars=c=>({c,current,number});emit('counts',v,[],'创建重复次数栈。');emit('prefixes',v,[],'创建外层前缀栈。');emit('current',v,[],'当前层内容为空。',{current});emit('number-init',v,[],'重复次数从 0 开始。',{number});for(let j=0;j<s.length;j++){const c=s[j];emit('loop',v,[j],'读取一个编码字符。',vars(c),memory());emit('digit',v,[j],/\d/.test(c)?'这是数字，继续累计重复次数。':'不是数字，检查括号或普通内容。',vars(c),memory());if(/\d/.test(c)){number=number*10+Number(c);if(number>20)throw Error('演示重复次数最多为 20');emit('number',v,[j],'支持多位数字，前值乘 10 后加当前位。',vars(c),memory());}else if(c==='['){emit('open',v,[j],'进入一个新的括号层。',vars(c),memory());if(number<1)throw Error('左括号之前必须有正整数次数');counts.push(number);prefixes.push(current);emit('save',v,[j],'保存外层状态。',vars(c),memory());current='';number=0;emit('reset',v,[j],'开始收集内层内容。',vars(c),memory());}else if(c===']'){emit('close',v,[j],'当前括号层结束。',vars(c),memory());if(!counts.length||number)throw Error('编码括号或数字格式无效');let parent=prefixes.pop();emit('parent',v,[j],'弹出外层字符串。',{...vars(c),parent},memory());const repeat=counts.pop();emit('repeat',v,[j],'弹出重复次数。',{...vars(c),repeat},memory());for(let i=0;i<repeat;i++){parent+=current;if(parent.length>400)throw Error('解码演示结果最多 400 个字符');emit('expand',v,[j],'将当前层内容追加到外层。',{...vars(c),i,repeat,parent},memory());}current=parent;emit('restore',v,[j],'恢复到外层。',vars(c),memory());}else{if(number)throw Error('数字之后必须紧接左括号');current+=c;emit('append',v,[j],'普通字符加入当前内容。',vars(c),memory());}}if(counts.length||number)throw Error('编码存在未关闭括号或孤立数字');emit('return',v,[],`解码结果为 ${current}。`,{current},memory());return current;})
};
