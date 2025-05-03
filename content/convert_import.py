import os
import re
import shutil
import sys

def convert_images_in_file(filepath):
    dir_name, base_name = os.path.split(filepath)
    name, ext = os.path.splitext(base_name)
    backup_path = os.path.join(dir_name, f"{name}_bak{ext}")

    # 跳过已有备份文件
    if os.path.exists(backup_path):
        print(f"已跳过（已有备份）：{filepath}")
        return

    shutil.copy2(filepath, backup_path)

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    pattern = r'!\[(.*?)\]\((.*?)\)'
    converted = re.sub(pattern, r'{{< figure src="\2" title="\1" >}}', content)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(converted)
    print(f"已转换：{filepath}")

def restore_from_backup(filepath):
    dir_name, base_name = os.path.split(filepath)
    name, ext = os.path.splitext(base_name)
    backup_path = os.path.join(dir_name, f"{name}_bak{ext}")

    if os.path.exists(backup_path):
        shutil.copy2(backup_path, filepath)
        print(f"已恢复：{filepath}")
    else:
        print(f"未找到备份：{filepath}")

def convert_images_in_directory(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".md") and not file.endswith("_bak.md"):
                filepath = os.path.join(root, file)
                convert_images_in_file(filepath)

def restore_backups_in_directory(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".md") and not file.endswith("_bak.md"):
                filepath = os.path.join(root, file)
                restore_from_backup(filepath)

# 命令行接口
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("用法：")
        print("  转换：python convert_images.py convert <目录路径>")
        print("  恢复：python convert_images.py restore <目录路径>")
        sys.exit(1)

    command = sys.argv[1]
    target_dir = sys.argv[2]

    if not os.path.isdir(target_dir):
        print("错误：指定路径不是目录")
        sys.exit(1)

    if command == "convert":
        convert_images_in_directory(target_dir)
        print("转换完成。所有原始文件已备份为 *_bak.md")
    elif command == "restore":
        restore_backups_in_directory(target_dir)
        print("恢复完成。")
    else:
        print("错误：未知命令，应为 convert 或 restore")
