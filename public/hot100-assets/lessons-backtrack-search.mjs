import {lesson,text,integer} from './lesson-kit.mjs';
const base={mode:'backtrack',stateLabel:'搜索路径 / 剪枝条件'};
function steps(emit,values,path,result){return (key,note,active=[],vars={})=>emit(key,values,active,note,{path:[...path],resultCount:result.length,...vars},result.map((v,i)=>[i,JSON.stringify(v)]),{searchPath:[...path]});}
export const backtrackSearchLessons={
22:lesson({...base,id:22,signature:'public List<String> generateParenthesis(int n)',sample:{n:3},expected:['((()))','(()())','(())()','()(())','()()()'],call:'new Solution().generateParenthesis(3)',description:'生成由 n 对括号组成的所有合法括号串。任意前缀中的右括号数量都不能超过左括号数量。',idea:'左括号还没用满就可追加左括号；右括号比左括号少才可追加右括号。直接限制合法前缀，避免先生成所有字符串再筛选。',invariant:'0 ≤ right ≤ left ≤ n，路径始终是某个合法结果的前缀。',time:'O(n·Cₙ)，Cₙ 为第 n 个卡特兰数',space:'O(n)，不计结果'},`class Solution {
    public List<String> generateParenthesis(int n) {
        List<String> result = new ArrayList<>(); // @init
        search(n, 0, 0, new StringBuilder(), result); // @start
        return result; // @return
    }
    private void search(int n, int left, int right, StringBuilder path, List<String> result) {
        if (path.length() == 2 * n) { // @complete
            result.add(path.toString()); // @record
            return;
        }
        if (left < n) { // @can-left
            path.append('('); // @left
            search(n, left + 1, right, path, result); // @recurse-left
            path.deleteCharAt(path.length() - 1); // @undo-left
        }
        if (right < left) { // @can-right
            path.append(')'); // @right
            search(n, left, right + 1, path, result); // @recurse-right
            path.deleteCharAt(path.length() - 1); // @undo-right
        }
    }
}`, ({n},emit)=>{integer(n,'n',1,4);const path=[],result=[],show=steps(emit,['(',')'],path,result);show('init','建立括号结果表。');show('start','从 0 个左右括号开始。');function search(left,right){show('complete','检查是否已经使用全部括号。',[],{n,left,right});if(path.length===2*n){result.push(path.join(''));show('record','合法前缀已成为完整结果。');return;}show('can-left',left<n?'还有左括号可用。':'左括号已用满。',[0],{left,right,n});if(left<n){path.push('(');show('left','追加一个左括号。',[0],{left:left+1,right});show('recurse-left','继续生成合法后缀。',[0],{left:left+1,right});search(left+1,right);path.pop();show('undo-left','撤销左括号选择。',[0],{left,right});}show('can-right',right<left?'存在尚未闭合的左括号。':'不能让右括号超过左括号。',[1],{left,right});if(right<left){path.push(')');show('right','追加一个右括号。',[1],{left,right:right+1});show('recurse-right','继续生成合法后缀。',[1],{left,right:right+1});search(left,right+1);path.pop();show('undo-right','撤销右括号选择。',[1],{left,right});}}search(0,0);show('return','返回全部合法括号串。');return result;}),
131:lesson({...base,id:131,signature:'public List<List<String>> partition(String s)',sample:{s:'aab'},expected:[['a','a','b'],['aa','b']],call:'new Solution().partition("aab")',description:'将字符串切分成若干连续子串，每段都是回文，返回全部切分方案。',idea:'从 start 枚举下一段的终点。只有回文段才加入路径并继续切剩余后缀；后缀完成后撤销这一段，探索其他切点。',invariant:'path 中所有段均为回文，拼接后恰好等于 s 的已处理前缀。',time:'O(n²·2ⁿ)，朴素回文检查的保守上界',space:'O(n)，不计结果'},`class Solution {
    public List<List<String>> partition(String s) {
        List<List<String>> result = new ArrayList<>(); // @init
        search(s, 0, new ArrayList<>(), result); // @start
        return result; // @return
    }
    private void search(String s, int start, List<String> path, List<List<String>> result) {
        if (start == s.length()) { // @complete
            result.add(new ArrayList<>(path)); // @record
            return;
        }
        for (int end = start; end < s.length(); end++) { // @loop
            if (!palindrome(s, start, end)) continue; // @check
            path.add(s.substring(start, end + 1)); // @choose
            search(s, end + 1, path, result); // @recurse
            path.remove(path.size() - 1); // @undo
        }
    }
    private boolean palindrome(String s, int left, int right) {
        while (left < right) { // @compare-loop
            if (s.charAt(left++) != s.charAt(right--)) return false; // @compare
        }
        return true; // @palindrome
    }
}`, ({s:input},emit)=>{const s=text(input,'s',8),path=[],result=[],show=steps(emit,[...s],path,result);show('init','建立切分结果表。');show('start','从字符串起点开始切分。');function pal(left,right){while(left<right){show('compare-loop','从两端向中间检查。',[left,right],{left,right});const equal=s[left++]===s[right--];show('compare',equal?'两端字符相同。':'两端不同，不是回文。',[left-1,right+1],{left,right});if(!equal)return false;}show('compare-loop','两指针已相遇或交错。',[],{left,right});show('palindrome','所有字符对均相同。');return true;}function search(start){show('complete','检查是否已经切完整串。',[],{start});if(start===s.length){result.push([...path]);show('record','复制完整回文切分方案。');return;}for(let end=start;end<s.length;end++){const active=Array.from({length:end-start+1},(_,i)=>start+i);show('loop','尝试一个连续区间。',active,{start,end});const valid=pal(start,end);show('check',valid?'当前区间为回文，可以选择。':'当前区间不是回文，剪枝。',active,{start,end});if(!valid)continue;path.push(s.slice(start,end+1));show('choose','把这一段加入切分路径。',active,{start,end});show('recurse','从区间之后继续切分。',active,{start:end+1});search(end+1);path.pop();show('undo','撤销这一段，尝试其他切点。',active,{start,end});}}search(0);show('return','返回全部回文切分。');return result;}),
79:lesson({...base,id:79,signature:'public boolean exist(char[][] board, String word)',sample:{board:[['A','B','C','E'],['S','F','C','S'],['A','D','E','E']],word:'ABCCED'},expected:true,call:"new Solution().exist(new char[][]{{'A','B','C','E'},{'S','F','C','S'},{'A','D','E','E'}},\"ABCCED\")",valueLabel:'字符网格（· 表示当前路径占用）',description:'判断能否在字符网格中沿上下左右相邻格拼出 word。同一个格子在同一条路径中最多使用一次。',idea:'从每个格子尝试 DFS。字符匹配后暂时标记格子已用，再搜索下一字符；返回前恢复格子。这样其他搜索路径仍能使用它。',invariant:'被标记的格子恰好是当前搜索路径，恢复后 board 与调用前一致。',time:'O(mn·3ᴸ)，L 为单词长度',space:'O(L)'},`class Solution {
    public boolean exist(char[][] board, String word) {
        for (int r = 0; r < board.length; r++) { // @row
            for (int c = 0; c < board[0].length; c++) { // @col
                if (search(board, word, r, c, 0)) return true; // @start
            }
        }
        return false; // @return
    }
    private boolean search(char[][] board, String word, int r, int c, int index) {
        if (r < 0 || c < 0 || r >= board.length || c >= board[0].length
                || board[r][c] != word.charAt(index)) return false; // @check
        if (index == word.length() - 1) return true; // @complete
        char saved = board[r][c]; // @save
        board[r][c] = '\0'; // @mark
        boolean found = search(board, word, r + 1, c, index + 1)
            || search(board, word, r - 1, c, index + 1)
            || search(board, word, r, c + 1, index + 1)
            || search(board, word, r, c - 1, index + 1); // @neighbors
        board[r][c] = saved; // @restore
        return found; // @found
    }
}`, ({board:input,word:raw},emit)=>{if(!Array.isArray(input)||!input.length||input.length>5||!input.every(r=>Array.isArray(r)&&r.length>0&&r.length<=5&&r.every(c=>typeof c==='string'&&/^[A-Za-z]$/.test(c)))||input.some(r=>r.length!==input[0].length))throw Error('board 须为最多 5×5 的字母矩阵');const board=input.map(r=>[...r]),word=text(raw,'word',10);if(!/^[A-Za-z]+$/.test(word))throw Error('word 须为非空字母串');const m=board.length,n=board[0].length,path=[];const show=(key,note,r,c,index,vars={})=>emit(key,board.flat(),r>=0&&r<m&&c>=0&&c<n?[r*n+c]:[],note,{word,r,c,index,path:[...path],...vars},[],{columns:n,searchPath:[...path]});function search(r,c,index){show('check','检查坐标、是否已用及字符是否匹配。',r,c,index);if(r<0||r>=m||c<0||c>=n||board[r][c]!==word[index])return false;show('complete',index===word.length-1?'最后一个字符匹配，找到单词。':'还需继续匹配后缀。',r,c,index);if(index===word.length-1)return true;const saved=board[r][c];show('save','保存原字符，以便恢复。',r,c,index,{saved});board[r][c]='·';path.push(`(${r},${c}) ${saved}`);show('mark','标记当前格已占用，防止路径重复使用。',r,c,index,{saved});show('neighbors','依次尝试下、上、右、左，成功时短路。',r,c,index);const found=search(r+1,c,index+1)||search(r-1,c,index+1)||search(r,c+1,index+1)||search(r,c-1,index+1);board[r][c]=saved;path.pop();show('restore','无论成败，恢复当前格。',r,c,index,{saved,found});show('found','返回当前搜索结果。',r,c,index,{found});return found;}for(let r=0;r<m;r++){show('row','逐行选择起点。',r,-1,0);for(let c=0;c<n;c++){show('col','尝试当前起点。',r,c,0);const found=search(r,c,0);show('start',found?'找到一条完整路径，返回 true。':'这个起点失败，尝试下一个。',r,c,0,{found});if(found)return true;}}show('return','所有起点均失败。',-1,-1,0);return false;}),
51:lesson({...base,id:51,signature:'public List<List<String>> solveNQueens(int n)',sample:{n:4},expected:[['.Q..','...Q','Q...','..Q.'],['..Q.','Q...','...Q','.Q..']],call:'new Solution().solveNQueens(4)',valueLabel:'棋盘（Q 为皇后，· 为空格）',description:'在 n×n 棋盘放置 n 个皇后，任何两个不能同行、同列或同斜线。返回全部棋盘方案。',idea:'每行只放一个皇后。用列、r−c+n−1 和 r+c 三组布尔标记快速检查冲突。放置后进入下一行，返回后撤销棋盘和占用标记。',invariant:'前 row 行各有一个皇后，所有已放皇后互不攻击。',time:'O(n·n!)，粗略上界，不计输出复制',space:'O(n²)，不计结果'},`class Solution {
    public List<List<String>> solveNQueens(int n) {
        char[][] board = new char[n][n]; // @init
        for (char[] row : board) Arrays.fill(row, '.'); // @empty
        List<List<String>> result = new ArrayList<>(); // @result
        search(0, board, new boolean[n], new boolean[2*n-1], new boolean[2*n-1], result); // @start
        return result; // @return
    }
    private void search(int row, char[][] board, boolean[] columns, boolean[] down, boolean[] up, List<List<String>> result) {
        int n = board.length; // @size
        if (row == n) { // @complete
            List<String> solution = new ArrayList<>(); // @solution
            for (char[] line : board) solution.add(new String(line)); // @copy
            result.add(solution); // @record
            return;
        }
        for (int col = 0; col < n; col++) { // @loop
            int d = row - col + n - 1, u = row + col; // @diagonals
            if (columns[col] || down[d] || up[u]) continue; // @conflict
            board[row][col] = 'Q'; // @place
            columns[col] = down[d] = up[u] = true; // @mark
            search(row + 1, board, columns, down, up, result); // @recurse
            board[row][col] = '.'; // @remove
            columns[col] = down[d] = up[u] = false; // @unmark
        }
    }
}`, ({n},emit)=>{integer(n,'n',1,5);const board=Array.from({length:n},()=>Array(n).fill('.')),columns=Array(n).fill(false),down=Array(2*n-1).fill(false),up=Array(2*n-1).fill(false),result=[];const show=(key,note,row=-1,col=-1,vars={})=>emit(key,board.flat().map(c=>c==='.'?'·':c),row>=0&&row<n&&col>=0?[row*n+col]:[],note,{row,col,columns:[...columns],down:[...down],up:[...up],resultCount:result.length,...vars},result.map((v,i)=>[i,v.join(' / ')]),{columns:n});show('init','建立棋盘。');show('empty','所有格子初始为空。');show('result','建立方案列表。');show('start','从第一行开始放皇后。');function search(row){show('size','读取棋盘大小。',row,-1,{n});show('complete',row===n?'全部行已放置皇后。':'继续选择当前行位置。',row);if(row===n){const solution=[];show('solution','建立独立方案副本。',row);for(const line of board){solution.push(line.join(''));show('copy','复制一行，避免后续撤销修改结果。',row,-1,{solution:[...solution]});}result.push(solution);show('record','记录完整棋盘。',row);return;}for(let col=0;col<n;col++){show('loop','尝试当前列。',row,col);const d=row-col+n-1,u=row+col;show('diagonals','计算两条斜线的编号。',row,col,{d,u});const conflict=columns[col]||down[d]||up[u];show('conflict',conflict?'列或斜线已被占用，剪枝。':'没有冲突，可以放置。',row,col,{d,u});if(conflict)continue;board[row][col]='Q';show('place','放置本行皇后。',row,col);columns[col]=down[d]=up[u]=true;show('mark','占用列及两条斜线。',row,col,{d,u});show('recurse','进入下一行。',row,col);search(row+1);board[row][col]='.';show('remove','撤销本行皇后。',row,col);columns[col]=down[d]=up[u]=false;show('unmark','释放列与斜线，尝试其他位置。',row,col,{d,u});}}search(0);show('return','返回全部互不攻击的布局。');return result;})
};
