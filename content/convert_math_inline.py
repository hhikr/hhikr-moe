import os
import re
import shutil
import sys

def convert_inline_math(content):
    # 跳过 ```...``` 代码块
    code_block_pattern = re.compile(r"(```.*?```)", re.DOTALL)
    parts = code_block_pattern.split(content)

    for i in range(len(parts)):
        if i % 2 == 0:
            # 在非代码块中替换 $...$ 为 \\( ... \\)
            parts[i] = re.sub(
                r'(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)',
                r'\\\\(\1\\\\)',
                parts[i]
            )
    return ''.join(parts)

def process_file(filepath):
    dir_name, base_name = os.path.split(filepath)
    name, ext = os.path.splitext(base_name)

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    converted = convert_inline_math(content)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(converted)

    print(f"已转换：{filepath}")

def convert_in_directory(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".md") and not file.endswith("_bak.md"):
                filepath = os.path.join(root, file)
                process_file(filepath)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("用法：python convert_math_inline.py <目录路径>")
        sys.exit(1)

    target_dir = sys.argv[1]
    if not os.path.isdir(target_dir):
        print("错误：指定路径不是目录")
        sys.exit(1)

    convert_in_directory(target_dir)
    print("内联数学公式转换完成")
