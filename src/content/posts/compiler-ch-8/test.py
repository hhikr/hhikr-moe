import threading
import time

# 全局变量
x = 0
y = 0
z = 0

# 信号量，初值为0
S1 = threading.Semaphore(0)
S2 = threading.Semaphore(0)

def P1():
    global x, y, z
    y = 1
    y = y + 3
    S1.release()      # V(S1)
    z = y + 1
    S2.acquire()      # P(S2)
    # time.sleep(0.1) # 取消注释可尝试不同的切换时机
    y = z + y

def P2():
    global x, y, z
    x = 1
    x = x + 5
    S1.acquire()      # P(S1)
    x = x + y
    S2.release()      # V(S2)
    time.sleep(0.1) # 取消注释可尝试不同的切换时机
    z = z + x

# 创建线程
t1 = threading.Thread(target=P1)
t2 = threading.Thread(target=P2)

# 启动线程
t1.start()
t2.start()

# 等待线程结束
t1.join()
t2.join()

print(f"x = {x}, y = {y}, z = {z}")