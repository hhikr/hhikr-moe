import os
import shutil
import sys

def restore_markdown_backups(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith("_bak.md"):
                bak_path = os.path.join(root, file)
                original_name = file.replace("_bak.md", ".md")
                original_path = os.path.join(root, original_name)

                shutil.copy2(bak_path, original_path)
                print(f"已恢复：{original_path}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("用法：python restore_bak.py <目录路径>")
        sys.exit(1)

    target_dir = sys.argv[1]
    if not os.path.isdir(target_dir):
        print("错误：指定路径不是目录")
        sys.exit(1)

    restore_markdown_backups(target_dir)
    print("所有 *_bak.md 已恢复为原始 .md 文件。")
