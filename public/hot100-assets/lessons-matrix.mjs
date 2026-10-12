import {lesson,matrix,integer} from './lesson-kit.mjs';
export const matrixLessons={
73:lesson({id:73,signature:'public void setZeroes(int[][] matrix)',sample:{matrix:[[1,1,1],[1,0,1],[1,1,1]]},expected:[[1,0,1],[0,0,0],[1,0,1]],call:'new Solution().setZeroes(matrix)',javaSetup:'int[][] matrix = {{1,1,1},{1,0,1},{1,1,1}};',javaResult:'matrix',print:'int[][] matrix = {{1,1,1},{1,0,1},{1,1,1}};\n        new Solution().setZeroes(matrix);\n        System.out.println(Arrays.deepToString(matrix));',description:'矩阵中原本为 0 的元素，其所在整行和整列都要变为 0。原地修改，使用常数额外空间。',idea:'用第一行和第一列保存清零标记。因为标记会占用它们，需要另外记录第一行、第一列原本是否含零。先打标记，再处理内部，最后处理标记所在边界。',invariant:'内部扫描阶段只修改第一行和第一列，不修改尚未扫描的内部值，防止新零引发错误传播。',time:'O(m n)',space:'O(1)',mode:'matrix',valueLabel:'矩阵 / matrix'},`class Solution {
    public void setZeroes(int[][] matrix) {
        int rows = matrix.length, columns = matrix[0].length; // @sizes
        boolean firstRow = false, firstCol = false; // @flags
        for (int c = 0; c < columns; c++) if (matrix[0][c] == 0) firstRow = true; // @check-row
        for (int r = 0; r < rows; r++) if (matrix[r][0] == 0) firstCol = true; // @check-col
        for (int r = 1; r < rows; r++) { // @mark-row
            for (int c = 1; c < columns; c++) { // @mark-col
                if (matrix[r][c] == 0) { // @zero
                    matrix[r][0] = 0; matrix[0][c] = 0; // @mark
                }
            }
        }
        for (int r = 1; r < rows; r++) { // @clear-row
            for (int c = 1; c < columns; c++) { // @clear-col
                if (matrix[r][0] == 0 || matrix[0][c] == 0) matrix[r][c] = 0; // @clear
            }
        }
        if (firstRow) Arrays.fill(matrix[0], 0); // @first-row
        if (firstCol) for (int r = 0; r < rows; r++) matrix[r][0] = 0; // @first-col
    }
}`,({matrix:input},emit)=>{const a=matrix(input),rows=a.length,columns=a[0].length;const at=(r,c)=>r*columns+c,show=(key,active,note,vars={})=>emit(key,a.flat(),active,note,{rows,columns,...vars});show('sizes',[],'记录矩阵大小。');let firstRow=false,firstCol=false;show('flags',[],'分别记录第一行和第一列的原始零。',{firstRow,firstCol});for(let c=0;c<columns;c++){if(a[0][c]===0)firstRow=true;show('check-row',[at(0,c)],'检查第一行是否原本含零。',{c,firstRow,firstCol});}for(let r=0;r<rows;r++){if(a[r][0]===0)firstCol=true;show('check-col',[at(r,0)],'检查第一列是否原本含零。',{r,firstRow,firstCol});}for(let r=1;r<rows;r++){show('mark-row',[],'扫描内部这一行。',{r,firstRow,firstCol});for(let c=1;c<columns;c++){show('mark-col',[at(r,c)],'检查内部元素。',{r,c});show('zero',[at(r,c)],a[r][c]===0?'原始元素为零，需要标记它的行列。':'该元素非零。',{r,c});if(a[r][c]===0){a[r][0]=0;a[0][c]=0;show('mark',[at(r,0),at(0,c)],'把行标记和列标记写入边界。',{r,c});}}}for(let r=1;r<rows;r++){show('clear-row',[],'根据标记处理内部行。',{r});for(let c=1;c<columns;c++){show('clear-col',[at(r,c)],'读取对应行和列的标记。',{r,c});const zero=a[r][0]===0||a[0][c]===0;if(zero)a[r][c]=0;show('clear',[at(r,c),at(r,0),at(0,c)],zero?'行或列被标记，清零当前元素。':'行列均未标记，保留当前元素。',{r,c});}}if(firstRow)a[0].fill(0);show('first-row',Array.from({length:columns},(_,c)=>at(0,c)),firstRow?'第一行原本含零，整行清零。':'第一行原本不含零，不额外清零。',{firstRow,firstCol});if(firstCol)for(let r=0;r<rows;r++)a[r][0]=0;show('first-col',Array.from({length:rows},(_,r)=>at(r,0)),firstCol?'第一列原本含零，整列清零。':'第一列原本不含零，不额外清零。',{firstRow,firstCol});return a;}),
54:lesson({id:54,signature:'public List<Integer> spiralOrder(int[][] matrix)',sample:{matrix:[[1,2,3],[4,5,6],[7,8,9]]},expected:[1,2,3,6,9,8,7,4,5],call:'new Solution().spiralOrder(new int[][]{{1,2,3},{4,5,6},{7,8,9}})',description:'按顺时针螺旋顺序访问矩阵中的全部元素，从左上角开始，返回访问序列。',idea:'维护尚未访问区域的四条边界。依次访问上边、右边、下边、左边，每完成一条边就收缩相应边界。访问下边、左边前再次检查，避免单行或单列重复。',invariant:'四条边界之外的元素都已恰好访问一次，内部元素尚未访问。',time:'O(m n)',space:'O(1)，不含输出',mode:'matrix',valueLabel:'矩阵 / matrix',stateLabel:'访问序列'},`class Solution {
    public List<Integer> spiralOrder(int[][] matrix) {
        List<Integer> ans = new ArrayList<>(); // @init
        int top = 0, bottom = matrix.length - 1, left = 0, right = matrix[0].length - 1; // @bounds
        while (top <= bottom && left <= right) { // @loop
            for (int c = left; c <= right; c++) ans.add(matrix[top][c]); // @top
            top++; // @top-shrink
            for (int r = top; r <= bottom; r++) ans.add(matrix[r][right]); // @right
            right--; // @right-shrink
            if (top <= bottom) { // @bottom-check
                for (int c = right; c >= left; c--) ans.add(matrix[bottom][c]); // @bottom
                bottom--; // @bottom-shrink
            }
            if (left <= right) { // @left-check
                for (int r = bottom; r >= top; r--) ans.add(matrix[r][left]); // @left
                left++; // @left-shrink
            }
        }
        return ans; // @return
    }
}`,({matrix:input},emit)=>{const a=matrix(input),columns=a[0].length,v=a.flat(),ans=[];let top=0,bottom=a.length-1,left=0,right=columns-1;const vars=()=>({top,bottom,left,right,columns});const memory=()=>ans.map((x,i)=>[i,x]);const show=(key,active,note)=>emit(key,v,active,note,vars(),memory());const visit=(r,c,key,note)=>{ans.push(a[r][c]);show(key,[r*columns+c],note);};show('init',[],'创建访问序列。');show('bounds',[],'设置未访问区域的四条边界。');while(top<=bottom&&left<=right){show('loop',[],'还有未访问的区域。');for(let c=left;c<=right;c++)visit(top,c,'top','沿上边从左到右访问。');top++;show('top-shrink',[],'上边界向内收缩。');for(let r=top;r<=bottom;r++)visit(r,right,'right','沿右边从上到下访问。');right--;show('right-shrink',[],'右边界向内收缩。');show('bottom-check',[],top<=bottom?'下边仍存在。':'没有下边需要访问。');if(top<=bottom){for(let c=right;c>=left;c--)visit(bottom,c,'bottom','沿下边从右到左访问。');bottom--;show('bottom-shrink',[],'下边界向内收缩。');}show('left-check',[],left<=right?'左边仍存在。':'没有左边需要访问。');if(left<=right){for(let r=bottom;r>=top;r--)visit(r,left,'left','沿左边从下到上访问。');left++;show('left-shrink',[],'左边界向内收缩。');}}show('return',[],'每个位置都已访问一次。');return ans;}),
48:lesson({id:48,signature:'public void rotate(int[][] matrix)',sample:{matrix:[[1,2,3],[4,5,6],[7,8,9]]},expected:[[7,4,1],[8,5,2],[9,6,3]],call:'new Solution().rotate(matrix)',javaSetup:'int[][] matrix = {{1,2,3},{4,5,6},{7,8,9}};',javaResult:'matrix',print:'int[][] matrix = {{1,2,3},{4,5,6},{7,8,9}};\n        new Solution().rotate(matrix);\n        System.out.println(Arrays.deepToString(matrix));',description:'把 n×n 方形矩阵原地顺时针旋转 90 度。不能新建另一个矩阵保存结果。',idea:'先沿主对角线转置，把 (r,c) 变成 (c,r)；再左右翻转每一行，把列 c 变成 n−1−c，组合后就是 (r,c) → (c,n−1−r)。',invariant:'转置阶段每对对称位置只交换一次；翻转阶段每行两端向中间收缩。',time:'O(n²)',space:'O(1)',mode:'matrix',valueLabel:'矩阵 / matrix'},`class Solution {
    public void rotate(int[][] matrix) {
        int n = matrix.length; // @size
        for (int r = 0; r < n; r++) { // @row
            for (int c = r + 1; c < n; c++) { // @column
                int temp = matrix[r][c]; // @temp-transpose
                matrix[r][c] = matrix[c][r]; // @transpose-a
                matrix[c][r] = temp; // @transpose-b
            }
        }
        for (int r = 0; r < n; r++) { // @reverse-row
            int left = 0, right = n - 1; // @bounds
            while (left < right) { // @reverse
                int temp = matrix[r][left]; // @temp-reverse
                matrix[r][left] = matrix[r][right]; // @reverse-a
                matrix[r][right] = temp; // @reverse-b
                left++; right--; // @move
            }
        }
    }
}`,({matrix:input},emit)=>{const a=matrix(input),n=a.length;if(a[0].length!==n)throw Error('旋转图像要求方形矩阵');const at=(r,c)=>r*n+c,show=(key,active,note,vars={})=>emit(key,a.flat(),active,note,{n,columns:n,...vars});show('size',[],'记录方形矩阵边长。');for(let r=0;r<n;r++){show('row',[],'开始转置这一行。',{r});for(let c=r+1;c<n;c++){const active=[at(r,c),at(c,r)];show('column',active,'只访问主对角线一侧，避免重复交换。',{r,c});const temp=a[r][c];show('temp-transpose',active,'暂存上三角位置的值。',{r,c,temp});a[r][c]=a[c][r];show('transpose-a',active,'把对称位置写入当前格。',{r,c,temp});a[c][r]=temp;show('transpose-b',active,'把暂存值写入对称位置。',{r,c,temp});}}for(let r=0;r<n;r++){show('reverse-row',[],'转置完成，翻转当前行。',{r});let left=0,right=n-1;show('bounds',[at(r,left),at(r,right)],'设置当前行的两端。',{r,left,right});while(left<right){const active=[at(r,left),at(r,right)];show('reverse',active,'交换这一行的左右端点。',{r,left,right});const temp=a[r][left];show('temp-reverse',active,'暂存左端点值。',{r,left,right,temp});a[r][left]=a[r][right];show('reverse-a',active,'右端点值写到左侧。',{r,left,right});a[r][right]=temp;show('reverse-b',active,'暂存值写到右侧。',{r,left,right});left++;right--;show('move',[],'指针向中间移动。',{r,left,right});}}show('reverse-row',[],'全部行已翻转，顺时针旋转完成。');return a;}),
240:lesson({id:240,signature:'public boolean searchMatrix(int[][] matrix, int target)',sample:{matrix:[[1,4,7,11],[2,5,8,12],[3,6,9,16]],target:5},expected:true,call:'new Solution().searchMatrix(new int[][]{{1,4,7,11},{2,5,8,12},{3,6,9,16}},5)',description:'矩阵每行从左到右递增，每列从上到下递增，判断目标值是否存在。整体按行展开未必有序。',idea:'从右上角开始。当前值大于目标时，整列下方更大，可向左淘汰该列；当前值小于目标时，整行左侧更小，可向下淘汰该行。',invariant:'目标若存在，始终位于当前行以下、当前列左侧的候选矩形中。',time:'O(m+n)',space:'O(1)',mode:'matrix',valueLabel:'矩阵 / matrix'},`class Solution {
    public boolean searchMatrix(int[][] matrix, int target) {
        int row = 0, col = matrix[0].length - 1; // @init
        while (row < matrix.length && col >= 0) { // @loop
            int value = matrix[row][col]; // @value
            if (value == target) return true; // @found
            if (value > target) col--; // @left
            else row++; // @down
        }
        return false; // @return
    }
}`,({matrix:input,target},emit)=>{const a=matrix(input),columns=a[0].length,v=a.flat();integer(target,'target');if(a.some((r,i)=>r.some((x,j)=>j&&x<r[j-1]||i&&x<a[i-1][j])))throw Error('矩阵每行和每列都必须非递减');let row=0,col=columns-1;const vars=()=>({row,col,target,columns});emit('init',v,[col],'从右上角开始。',vars());while(row<a.length&&col>=0){const index=row*columns+col;emit('loop',v,[index],'当前位置仍在矩阵内。',vars());const value=a[row][col];emit('value',v,[index],`读取 matrix[${row}][${col}] = ${value}。`,{...vars(),value});emit('found',v,[index],value===target?'找到目标。':'当前值不是目标。',{...vars(),value});if(value===target)return true;if(value>target){col--;emit('left',v,[],`当前列下方都大于 ${target}，淘汰该列。`,vars());}else{row++;emit('down',v,[],`当前行左侧都小于 ${target}，淘汰该行。`,vars());}}emit('return',v,[],'候选区域为空，目标不存在。',vars());return false;})
};
