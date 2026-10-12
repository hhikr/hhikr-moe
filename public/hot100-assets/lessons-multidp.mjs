import {lesson,matrix,integer,text} from './lesson-kit.mjs';
function gridSteps(emit,dp){return (key,active,note,vars={})=>emit(key,dp.flat(),active.map(([r,c])=>r*dp[0].length+c),note,vars,[],{columns:dp[0].length});}
const base={mode:'dp',valueLabel:'DP 状态表（行、列从 0 开始）',stateLabel:'状态转移'};
export const multidpLessons={
62:lesson({...base,id:62,signature:'public int uniquePaths(int m, int n)',sample:{m:3,n:7},expected:28,call:'new Solution().uniquePaths(3,7)',description:'机器人从 m×n 网格左上角出发，每次只能向右或向下移动一格，求到右下角的不同路径数。',idea:'到达某格的最后一步来自上方或左方，因此路径数等于两者之和。第一行、第一列只有一种走法。',invariant:'处理 (r,c) 时，上方和左方状态已经求出。',time:'O(mn)',space:'O(mn)'},`class Solution {
    public int uniquePaths(int m, int n) {
        int[][] dp = new int[m][n]; // @init
        for (int r = 0; r < m; r++) { // @row
            for (int c = 0; c < n; c++) { // @col
                if (r == 0 || c == 0) dp[r][c] = 1; // @boundary
                else dp[r][c] = dp[r - 1][c] + dp[r][c - 1]; // @sum
            }
        }
        return dp[m - 1][n - 1]; // @return
    }
}`, ({m,n},emit)=>{integer(m,'m',1,8);integer(n,'n',1,8);const dp=Array.from({length:m},()=>Array(n).fill(0)),show=gridSteps(emit,dp);show('init',[],'建立路径计数表。',{m,n});for(let r=0;r<m;r++){show('row',[],'从上到下处理各行。',{r});for(let c=0;c<n;c++){show('col',[[r,c]],'计算当前格的路径数。',{r,c});if(r===0||c===0){dp[r][c]=1;show('boundary',[[r,c]],'边界只有沿一个方向移动的走法。',{r,c});}else{show('boundary',[[r,c]],'内部格需要合并两种来源。',{r,c});dp[r][c]=dp[r-1][c]+dp[r][c-1];show('sum',[[r-1,c],[r,c-1],[r,c]],'上方路径数加左方路径数。',{r,c,fromTop:dp[r-1][c],fromLeft:dp[r][c-1]});}}}show('return',[[m-1,n-1]],'读取右下角的路径数量。');return dp[m-1][n-1];}),
64:lesson({...base,id:64,signature:'public int minPathSum(int[][] grid)',sample:{matrix:[[1,3,1],[1,5,1],[4,2,1]]},expected:7,call:'new Solution().minPathSum(new int[][]{{1,3,1},{1,5,1},{4,2,1}})',description:'非负数字网格中，从左上到右下每次只向右或向下，求经过节点值之和的最小值。演示使用 matrix 输入。',idea:'当前最小代价等于当前格值加上上方、左方最小代价中较小者。边界只有一个来源。',invariant:'dp[r][c] 是从起点到该格的最小路径和。',time:'O(mn)',space:'O(mn)'},`class Solution {
    public int minPathSum(int[][] grid) {
        int m = grid.length, n = grid[0].length; // @size
        int[][] dp = new int[m][n]; // @init
        for (int r = 0; r < m; r++) { // @row
            for (int c = 0; c < n; c++) { // @col
                if (r == 0 && c == 0) dp[r][c] = grid[r][c]; // @origin
                else if (r == 0) dp[r][c] = grid[r][c] + dp[r][c - 1]; // @top
                else if (c == 0) dp[r][c] = grid[r][c] + dp[r - 1][c]; // @left
                else dp[r][c] = grid[r][c] + Math.min(dp[r - 1][c], dp[r][c - 1]); // @minimum
            }
        }
        return dp[m - 1][n - 1]; // @return
    }
}`, (input,emit)=>{const a=matrix(input.matrix);if(a.flat().some(v=>v<0))throw Error('matrix 不能包含负数');const m=a.length,n=a[0].length,dp=Array.from({length:m},()=>Array(n).fill(0)),show=gridSteps(emit,dp);show('size',[],'读取行数和列数。',{m,n,matrix:a});show('init',[],'建立最小代价表。');for(let r=0;r<m;r++){show('row',[],'逐行计算。',{r});for(let c=0;c<n;c++){show('col',[[r,c]],'处理当前格。',{r,c,value:a[r][c]});if(r===0&&c===0){dp[r][c]=a[r][c];show('origin',[[r,c]],'起点代价就是起点的值。',{r,c});}else if(r===0){show('origin',[[r,c]],'当前格不是起点。',{r,c});dp[r][c]=a[r][c]+dp[r][c-1];show('top',[[r,c-1],[r,c]],'第一行只能从左方到达。',{r,c});}else if(c===0){show('origin',[[r,c]],'当前格不是起点。',{r,c});show('top',[[r,c]],'当前格不在第一行。',{r,c});dp[r][c]=a[r][c]+dp[r-1][c];show('left',[[r-1,c],[r,c]],'第一列只能从上方到达。',{r,c});}else{show('origin',[[r,c]],'当前格不是起点。',{r,c});show('top',[[r,c]],'不在第一行。',{r,c});show('left',[[r,c]],'不在第一列。',{r,c});dp[r][c]=a[r][c]+Math.min(dp[r-1][c],dp[r][c-1]);show('minimum',[[r-1,c],[r,c-1],[r,c]],'较小的前驱代价加上当前值。',{r,c,value:a[r][c]});}}}show('return',[[m-1,n-1]],'右下角保存最小路径和。');return dp[m-1][n-1];}),
5:lesson({...base,id:5,signature:'public String longestPalindrome(String s)',sample:{s:'babad'},expected:'bab',call:'new Solution().longestPalindrome("babad")',description:'返回字符串中最长的回文子串。如果有多个最长结果，题目允许任意一个；本课按左端点先后保留第一次找到的结果。',idea:'dp[left][right] 表示这个区间是否为回文。两端字符相等，而且内部是回文；长度不超过 3 时内部无需再判断。按长度递增，保证内部先求出。',invariant:'处理长度 len 前，更短区间的回文状态已确定。',time:'O(n²)',space:'O(n²)'},`class Solution {
    public String longestPalindrome(String s) {
        int n = s.length(), start = 0, best = 0; // @init
        boolean[][] dp = new boolean[n][n]; // @table
        for (int len = 1; len <= n; len++) { // @length
            for (int left = 0; left + len <= n; left++) { // @loop
                int right = left + len - 1; // @right
                dp[left][right] = s.charAt(left) == s.charAt(right)
                    && (len <= 3 || dp[left + 1][right - 1]); // @check
                if (dp[left][right] && len > best) { // @better
                    start = left; best = len; // @update
                }
            }
        }
        return s.substring(start, start + best); // @return
    }
}`, ({s:input},emit)=>{const s=text(input,'s',16),n=s.length;let start=0,best=0;const dp=Array.from({length:n},()=>Array(n).fill(false));if(!n){emit('init',[],[],'空字符串的答案为空。',{n,start,best});emit('table',[],[],'状态表为空。');emit('length',[],[],'没有非空区间。');emit('return',[],[],'返回空字符串。');return '';}const show=gridSteps(emit,dp);show('init',[],'初始化最长结果。',{s,n,start,best});show('table',[],'建立区间回文表：行为左端点，列为右端点。');for(let len=1;len<=n;len++){show('length',[],'按区间长度递增。',{len});for(let left=0;left+len<=n;left++){show('loop',[],'枚举这个长度的左端点。',{len,left});const right=left+len-1;show('right',[[left,right]],'计算右端点。',{left,right,len});dp[left][right]=s[left]===s[right]&&(len<=3||dp[left+1][right-1]);show('check',len>3?[[left,right],[left+1,right-1]]:[[left,right]],'两端相等，并检查内部回文。',{left,right,len,substring:s.slice(left,right+1)});show('better',[[left,right]],'只有更长的回文才替换答案。',{start,best,len});if(dp[left][right]&&len>best){start=left;best=len;show('update',[[left,right]],'更新最长回文的起点和长度。',{start,best});}}}show('return',[[start,start+best-1]],'从原字符串截取最长回文。',{start,best,answer:s.slice(start,start+best)});return s.slice(start,start+best);}),
1143:lesson({...base,id:1143,signature:'public int longestCommonSubsequence(String text1, String text2)',sample:{text1:'abcde',text2:'ace'},expected:3,call:'new Solution().longestCommonSubsequence("abcde","ace")',description:'求两个字符串的最长公共子序列长度。子序列保持原相对顺序，但字符不必连续。',idea:'dp[i][j] 比较两个前缀。末尾相等就把它接在更短前缀的公共序列后；末尾不同则分别舍弃一边，选择较长结果。',invariant:'dp[i][j] 是 text1 前 i 个字符与 text2 前 j 个字符的最长公共子序列长度。',time:'O(mn)',space:'O(mn)'},`class Solution {
    public int longestCommonSubsequence(String text1, String text2) {
        int m = text1.length(), n = text2.length(); // @size
        int[][] dp = new int[m + 1][n + 1]; // @init
        for (int i = 1; i <= m; i++) { // @row
            for (int j = 1; j <= n; j++) { // @col
                if (text1.charAt(i - 1) == text2.charAt(j - 1)) // @compare
                    dp[i][j] = dp[i - 1][j - 1] + 1; // @same
                else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]); // @different
            }
        }
        return dp[m][n]; // @return
    }
}`, (input,emit)=>{const a=text(input.text1,'text1',12),b=text(input.text2,'text2',12),m=a.length,n=b.length,dp=Array.from({length:m+1},()=>Array(n+1).fill(0)),show=gridSteps(emit,dp);show('size',[],'读取两字符串长度。',{text1:a,text2:b,m,n});show('init',[],'空前缀的公共序列长度为 0。');for(let i=1;i<=m;i++){show('row',[],'扩展第一个字符串前缀。',{i});for(let j=1;j<=n;j++){show('col',[[i,j]],'扩展第二个字符串前缀。',{i,j});show('compare',[[i,j]],'比较两个前缀的最后一个字符。',{i,j,a:a[i-1],b:b[j-1]});if(a[i-1]===b[j-1]){dp[i][j]=dp[i-1][j-1]+1;show('same',[[i-1,j-1],[i,j]],'相同字符接在较短前缀公共序列后。',{i,j});}else{dp[i][j]=Math.max(dp[i-1][j],dp[i][j-1]);show('different',[[i-1,j],[i,j-1],[i,j]],'舍弃一侧末尾，选择较长结果。',{i,j});}}}show('return',[[m,n]],'读取完整前缀的答案。');return dp[m][n];}),
72:lesson({...base,id:72,signature:'public int minDistance(String word1, String word2)',sample:{word1:'horse',word2:'ros'},expected:3,call:'new Solution().minDistance("horse","ros")',description:'将 word1 转换成 word2，每次可插入、删除或替换一个字符，求最少操作次数。',idea:'相同末尾字符无需操作。不同则比较删除、插入、替换三个前驱，加上本次操作。空前缀转换的代价是另一个前缀长度。',invariant:'dp[i][j] 是 word1 前 i 个字符转换为 word2 前 j 个字符的最小代价。',time:'O(mn)',space:'O(mn)'},`class Solution {
    public int minDistance(String word1, String word2) {
        int m = word1.length(), n = word2.length(); // @size
        int[][] dp = new int[m + 1][n + 1]; // @init
        for (int i = 0; i <= m; i++) dp[i][0] = i; // @delete-all
        for (int j = 0; j <= n; j++) dp[0][j] = j; // @insert-all
        for (int i = 1; i <= m; i++) { // @row
            for (int j = 1; j <= n; j++) { // @col
                if (word1.charAt(i - 1) == word2.charAt(j - 1)) // @compare
                    dp[i][j] = dp[i - 1][j - 1]; // @same
                else dp[i][j] = 1 + Math.min(dp[i - 1][j - 1],
                    Math.min(dp[i - 1][j], dp[i][j - 1])); // @edit
            }
        }
        return dp[m][n]; // @return
    }
}`, (input,emit)=>{const a=text(input.word1,'word1',12),b=text(input.word2,'word2',12),m=a.length,n=b.length,dp=Array.from({length:m+1},()=>Array(n+1).fill(0)),show=gridSteps(emit,dp);show('size',[],'读取字符串长度。',{word1:a,word2:b,m,n});show('init',[],'建立编辑距离表。');for(let i=0;i<=m;i++){dp[i][0]=i;show('delete-all',[[i,0]],'删除整个前缀才能变为空串。',{i});}for(let j=0;j<=n;j++){dp[0][j]=j;show('insert-all',[[0,j]],'从空串插入全部目标字符。',{j});}for(let i=1;i<=m;i++){show('row',[],'扩展原字符串前缀。',{i});for(let j=1;j<=n;j++){show('col',[[i,j]],'计算当前前缀转换代价。',{i,j});show('compare',[[i,j]],'比较末尾字符。',{i,j,a:a[i-1],b:b[j-1]});if(a[i-1]===b[j-1]){dp[i][j]=dp[i-1][j-1];show('same',[[i-1,j-1],[i,j]],'末尾相同，不增加操作。',{i,j});}else{dp[i][j]=1+Math.min(dp[i-1][j-1],dp[i-1][j],dp[i][j-1]);show('edit',[[i-1,j-1],[i-1,j],[i,j-1],[i,j]],'替换、删除、插入三种代价取最小，再加一。',{i,j,replace:dp[i-1][j-1],delete:dp[i-1][j],insert:dp[i][j-1]});}}}show('return',[[m,n]],'完整字符串转换的最小操作数。');return dp[m][n];})
};
