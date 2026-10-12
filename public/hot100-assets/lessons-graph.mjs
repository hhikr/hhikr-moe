import {lesson,matrix,array,integer} from './lesson-kit.mjs';
const gridBase={mode:'matrix',valueLabel:'网格（行、列从 0 开始）',stateLabel:'搜索状态'};
export const graphLessons={
200:lesson({...gridBase,id:200,signature:'public int numIslands(char[][] grid)',sample:{matrix:[[1,1,0,0],[1,0,0,1],[0,0,1,1]]},expected:2,call:"new Solution().numIslands(new char[][]{{'1','1','0','0'},{'1','0','0','1'},{'0','0','1','1'}})",description:'网格中 1 为陆地，0 为水。上下左右相连的陆地属于同一岛屿，求岛屿数量。Java 参数是字符矩阵，动画输入使用数字矩阵。',idea:'扫描到未访问陆地时增加一个岛屿，然后用 DFS 将整片相连陆地改为 0。以后再扫描到这些格子时不会重复计数。',invariant:'已经发现的岛屿全部标记为水；每个新 1 都代表尚未计数的连通分量。',time:'O(mn)',space:'O(mn)，最坏递归深度'},`class Solution {
    public int numIslands(char[][] grid) {
        int count = 0; // @init
        for (int r = 0; r < grid.length; r++) { // @row
            for (int c = 0; c < grid[0].length; c++) { // @col
                if (grid[r][c] == '1') { // @land
                    count++; // @count
                    sink(grid, r, c); // @start
                }
            }
        }
        return count; // @return
    }
    private void sink(char[][] grid, int r, int c) {
        if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length
                || grid[r][c] != '1') return; // @boundary
        grid[r][c] = '0'; // @mark
        sink(grid, r - 1, c); // @up
        sink(grid, r + 1, c); // @down
        sink(grid, r, c - 1); // @left
        sink(grid, r, c + 1); // @right
    }
}`, (input,emit)=>{const grid=matrix(input.matrix);if(grid.flat().some(v=>v!==0&&v!==1))throw Error('岛屿网格只能包含 0 和 1');const m=grid.length,n=grid[0].length;let count=0;const show=(key,note,r=-1,c=-1,vars={})=>emit(key,grid.flat(),r>=0&&r<m&&c>=0&&c<n?[r*n+c]:[],note,{count,r,c,...vars},[],{columns:n});show('init','岛屿计数从 0 开始。');function sink(r,c,depth){show('boundary','检查是否越界或已经是水。',r,c,{depth});if(r<0||r>=m||c<0||c>=n||grid[r][c]!==1)return;grid[r][c]=0;show('mark','把陆地标记为水，避免重复访问。',r,c,{depth});for(const [key,dr,dc] of [['up',-1,0],['down',1,0],['left',0,-1],['right',0,1]]){show(key,'沿这个方向搜索相连陆地。',r,c,{depth});sink(r+dr,c+dc,depth+1);}}for(let r=0;r<m;r++){show('row','逐行扫描。',r);for(let c=0;c<n;c++){show('col','逐列扫描。',r,c);show('land',grid[r][c]===1?'发现未访问陆地。':'水域或已处理陆地，跳过。',r,c);if(grid[r][c]===1){count++;show('count','发现新的岛屿，计数加一。',r,c);show('start','淹没当前连通分量。',r,c);sink(r,c,0);}}}show('return','全部网格扫描完成。');return count;}),
994:lesson({...gridBase,id:994,signature:'public int orangesRotting(int[][] grid)',sample:{matrix:[[2,1,1],[1,1,0],[0,1,1]]},expected:4,call:'new Solution().orangesRotting(new int[][]{{2,1,1},{1,1,0},{0,1,1}})',description:'0 为空格，1 为新鲜橘子，2 为腐烂橘子。每分钟腐烂橘子使上下左右的新鲜橘子腐烂，求全部腐烂所需最少分钟；无法全部腐烂返回 −1。',idea:'把所有初始腐烂橘子同时入队，进行多源 BFS。每层代表同一分钟发生的传播，新感染节点下一分钟才继续传播。',invariant:'每轮开始时，队列中的橘子正好是上一分钟新增的传播源。',time:'O(mn)',space:'O(mn)'},`class Solution {
    public int orangesRotting(int[][] grid) {
        int m = grid.length, n = grid[0].length, fresh = 0, minutes = 0; // @init
        Deque<int[]> queue = new ArrayDeque<>(); // @queue
        for (int r = 0; r < m; r++) { // @row
            for (int c = 0; c < n; c++) { // @col
                if (grid[r][c] == 1) fresh++; // @fresh
                if (grid[r][c] == 2) queue.add(new int[]{r, c}); // @source
            }
        }
        int[][] directions = {{1,0},{-1,0},{0,1},{0,-1}}; // @directions
        while (fresh > 0 && !queue.isEmpty()) { // @loop
            int size = queue.size(); // @size
            for (int i = 0; i < size; i++) { // @each
                int[] cell = queue.remove(); // @take
                for (int[] d : directions) { // @direction
                    int r = cell[0] + d[0], c = cell[1] + d[1]; // @neighbor
                    if (r < 0 || c < 0 || r >= m || c >= n || grid[r][c] != 1) continue; // @check
                    grid[r][c] = 2; fresh--; // @rot
                    queue.add(new int[]{r, c}); // @enqueue
                }
            }
            minutes++; // @minute
        }
        return fresh == 0 ? minutes : -1; // @return
    }
}`, (input,emit)=>{const grid=matrix(input.matrix);if(grid.flat().some(v=>v<0||v>2))throw Error('橘子网格只能包含 0、1、2');const m=grid.length,n=grid[0].length,queue=[];let fresh=0,minutes=0;const show=(key,note,active=[],vars={})=>emit(key,grid.flat(),active,note,{fresh,minutes,queue:queue.map(([r,c])=>`(${r},${c})`),...vars},[],{columns:n});show('init','初始化计数和时间。');show('queue','建立所有传播源共享的队列。');for(let r=0;r<m;r++){show('row','扫描一行。',[],{r});for(let c=0;c<n;c++){show('col','扫描一个格子。',[r*n+c],{r,c});if(grid[r][c]===1)fresh++;show('fresh','统计新鲜橘子。',[r*n+c],{r,c});if(grid[r][c]===2)queue.push([r,c]);show('source','初始腐烂橘子入队。',[r*n+c],{r,c});}}const directions=[[1,0],[-1,0],[0,1],[0,-1]];show('directions','只能沿上下左右传播。');while(fresh>0&&queue.length){show('loop','仍有新鲜橘子且存在传播源。');const size=queue.length;show('size','固定本分钟传播源数量。',[],{size});for(let i=0;i<size;i++){show('each','处理本层一个传播源。',[],{i,size});const cell=queue.shift();show('take','传播源出队。',[cell[0]*n+cell[1]],{cell});for(const d of directions){show('direction','选择一个传播方向。',[cell[0]*n+cell[1]],{d});const r=cell[0]+d[0],c=cell[1]+d[1];const active=r>=0&&r<m&&c>=0&&c<n?[r*n+c]:[];show('neighbor','计算邻居坐标。',active,{r,c});show('check','只感染范围内的新鲜橘子。',active,{r,c});if(r<0||r>=m||c<0||c>=n||grid[r][c]!==1)continue;grid[r][c]=2;fresh--;show('rot','新鲜橘子变为腐烂，数量减一。',active,{r,c});queue.push([r,c]);show('enqueue','新感染节点留待下一分钟传播。',active,{r,c});}}minutes++;show('minute','当前传播层完成，时间增加一分钟。');}show('return',fresh===0?'全部腐烂，返回分钟数。':'剩余新鲜橘子不可达，返回 −1。');return fresh===0?minutes:-1;}),
207:lesson({id:207,signature:'public boolean canFinish(int numCourses, int[][] prerequisites)',sample:{numCourses:4,prerequisites:[[1,0],[2,0],[3,1],[3,2]]},expected:true,call:'new Solution().canFinish(4,new int[][]{{1,0},{2,0},{3,1},{3,2}})',mode:'graph',valueLabel:'课程编号',stateLabel:'入度 / 先修边',description:'课程编号为 0 到 numCourses−1。[a,b] 表示学习 a 前必须完成 b，判断能否完成全部课程。',idea:'把先修关系画成 b→a。有向环会让环中课程永远无法满足条件。拓扑排序从入度为 0 的课程开始，完成后删除其出边，解锁新的零入度课程。',invariant:'入度等于尚未完成的先修课数量；队列中的课程都可以立即学习。',time:'O(V+E)',space:'O(V+E)'},`class Solution {
    public boolean canFinish(int numCourses, int[][] prerequisites) {
        List<List<Integer>> graph = new ArrayList<>(); // @init
        for (int i = 0; i < numCourses; i++) graph.add(new ArrayList<>()); // @vertices
        int[] indegree = new int[numCourses]; // @degrees
        for (int[] edge : prerequisites) { // @edge
            graph.get(edge[1]).add(edge[0]); // @connect
            indegree[edge[0]]++; // @increment
        }
        Deque<Integer> queue = new ArrayDeque<>(); // @queue
        for (int i = 0; i < numCourses; i++) if (indegree[i] == 0) queue.add(i); // @ready
        int completed = 0; // @count
        while (!queue.isEmpty()) { // @loop
            int course = queue.remove(); completed++; // @take
            for (int next : graph.get(course)) { // @neighbor
                if (--indegree[next] == 0) queue.add(next); // @unlock
            }
        }
        return completed == numCourses; // @return
    }
}`, ({numCourses:count,prerequisites},emit)=>{integer(count,'numCourses',1,12);if(!Array.isArray(prerequisites)||prerequisites.length>30)throw Error('prerequisites 最多包含 30 条边');const edges=prerequisites.map(e=>{const v=array(e,'先修关系',{min:2,max:2});v.forEach(x=>integer(x,'课程编号',0,count-1));return v;});const graph=Array.from({length:count},()=>[]),indegree=Array(count).fill(0),queue=[],built=[];let completed=0;const show=(key,note,active=[],vars={})=>emit(key,Array.from({length:count},(_,i)=>i),active,note,{queue:[...queue],completed,...vars},indegree.map((d,i)=>[i,d]),{network:{labels:Array.from({length:count},(_,i)=>String(i)),edges:built.map(([a,b])=>({from:b,to:a,label:''})),removed:[]}});show('init','建立邻接表。');for(let i=0;i<count;i++)show('vertices','为课程建立出边列表。',[i],{i});show('degrees','入度初始为 0。');for(const edge of edges){show('edge','读取一条先修关系。',edge,{edge});graph[edge[1]].push(edge[0]);built.push(edge);show('connect','先修课程连向依赖它的课程。',edge,{edge});indegree[edge[0]]++;show('increment','目标课程增加一个未完成先修。',edge,{edge});}show('queue','建立可学习课程队列。');for(let i=0;i<count;i++){if(indegree[i]===0)queue.push(i);show('ready','零入度课程入队。',[i],{i});}show('count','完成计数置零。');while(queue.length){show('loop','队列中存在可学习课程。');const course=queue.shift();completed++;show('take','完成队头课程。',[course],{course});for(const next of graph[course]){show('neighbor','处理依赖这门课程的后继。',[course,next],{course,next});indegree[next]--;if(indegree[next]===0)queue.push(next);show('unlock','移除一个未完成先修；归零则入队。',[next],{course,next});}}show('return',completed===count?'所有课程都完成，图无环。':'仍有课程未完成，剩余依赖中存在环。');return completed===count;})
};
