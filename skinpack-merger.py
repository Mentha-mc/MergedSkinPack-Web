#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Minecraft 皮肤包合并工具 (交互式版本)
纯命令行交互式界面，无需参数或GUI
"""

import os
import json
import re
import shutil
import zipfile
import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple, Set
from collections import defaultdict
import logging

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


def clear_screen():
    """清屏"""
    os.system('cls' if os.name == 'nt' else 'clear')


class SkinPackInfo:
    """皮肤包信息类"""
    def __init__(self, folder_name: str, skin_data: Dict, geometry_data: List, 
                 texture_files: List[Path], other_files: List[Path]):
        self.folder_name = folder_name
        self.skin_data = skin_data
        self.geometry_data = geometry_data
        self.texture_files = texture_files
        self.other_files = other_files
        self.info = self._analyze_pack()
    
    def _analyze_pack(self) -> Dict:
        """分析皮肤包信息"""
        info = {
            'serialize_name': self.skin_data.get('serialize_name', '未知'),
            'localization_name': self.skin_data.get('localization_name', '未知'),
            'skin_count': len(self.skin_data.get('skins', [])),
            'geometry_count': len(self.geometry_data),
            'texture_count': len(self.texture_files),
            'other_count': len(self.other_files),
            'geometries': set(),
            'textures': set()
        }
        
        # 收集几何模型和纹理引用
        for skin in self.skin_data.get('skins', []):
            if skin.get('geometry'):
                info['geometries'].add(skin['geometry'])
            if skin.get('texture'):
                info['textures'].add(skin['texture'])
        
        info['geometries'] = list(info['geometries'])
        info['textures'] = list(info['textures'])
        
        return info


class GeometryConverter:
    """几何模型格式转换器"""
    
    @staticmethod
    def convert_to_new_format(data: Dict) -> Dict:
        """将旧格式几何模型转换为新格式"""
        if 'minecraft:geometry' in data:
            return data
        
        geometry_keys = [key for key in data.keys() if key.startswith('geometry.')]
        if not geometry_keys:
            return None
        
        new_geometries = []
        
        for geometry_key in geometry_keys:
            old_geometry = data[geometry_key]
            
            new_geometry = {
                'description': {
                    'identifier': geometry_key,
                    'texture_width': old_geometry.get('texturewidth', 16),
                    'texture_height': old_geometry.get('textureheight', 16),
                    'visible_bounds_width': old_geometry.get('visible_bounds_width', 2),
                    'visible_bounds_height': old_geometry.get('visible_bounds_height', 2),
                    'visible_bounds_offset': old_geometry.get('visible_bounds_offset', [0, 1, 0])
                },
                'bones': old_geometry.get('bones', [])
            }
            
            new_geometries.append(new_geometry)
        
        return {
            'format_version': '1.12.0',
            'minecraft:geometry': new_geometries
        }


class JSONCleaner:
    """JSON清理器，用于处理带注释的JSON文件"""
    
    @staticmethod
    def clean_json_comments(json_string: str) -> str:
        """清理JSON中的注释"""
        # 移除单行注释
        cleaned = re.sub(r'//.*$', '', json_string, flags=re.MULTILINE)
        # 移除多行注释
        cleaned = re.sub(r'/\*[\s\S]*?\*/', '', cleaned)
        # 移除多余的逗号
        cleaned = re.sub(r',(\s*[}\]])', r'\1', cleaned)
        return cleaned
    
    @staticmethod
    def load_json_file(file_path: Path) -> Dict:
        """加载JSON文件，支持注释"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return json.loads(content)
        except json.JSONDecodeError:
            print(f"⚠️  清理JSON注释: {file_path.name}")
            cleaned_content = JSONCleaner.clean_json_comments(content)
            return json.loads(cleaned_content)


class SkinPackMerger:
    """皮肤包合并器"""
    
    def __init__(self, package_name: str = "MergedSkinPack", display_name: str = "合并皮肤包"):
        self.package_name = package_name
        self.display_name = display_name
        self.loaded_packs: List[SkinPackInfo] = []
    
    def load_skin_pack_folder(self, folder_path: Path) -> bool:
        """加载单个皮肤包文件夹"""
        try:
            print(f"📁 处理文件夹: {folder_path.name}")
            
            # 查找skins.json文件
            skins_json = folder_path / 'skins.json'
            if not skins_json.exists():
                print(f"❌ 未找到skins.json: {folder_path}")
                return False
            
            # 加载皮肤数据
            skin_data = JSONCleaner.load_json_file(skins_json)
            
            # 查找几何模型文件
            geometry_data = []
            for geo_file in folder_path.glob('*.json'):
                if geo_file.name.lower() in ['skins.json']:
                    continue
                if 'geometry' in geo_file.name.lower() or 'model' in geo_file.name.lower():
                    try:
                        geo_data = JSONCleaner.load_json_file(geo_file)
                        geometry_data.append({
                            'file_name': geo_file.name,
                            'data': geo_data
                        })
                    except Exception as e:
                        print(f"⚠️  几何模型读取失败: {geo_file.name} - {e}")
            
            # 收集纹理文件
            texture_extensions = {'.png', '.jpg', '.jpeg'}
            texture_files = [f for f in folder_path.iterdir() 
                           if f.is_file() and f.suffix.lower() in texture_extensions]
            
            # 收集其他文件
            other_files = [f for f in folder_path.iterdir() 
                          if f.is_file() and f.suffix.lower() not in texture_extensions 
                          and f.suffix == '.json' and f not in [skins_json] + [Path(folder_path / g['file_name']) for g in geometry_data]]
            
            # 创建皮肤包信息
            pack_info = SkinPackInfo(
                folder_path.name,
                skin_data,
                geometry_data,
                texture_files,
                other_files
            )
            
            self.loaded_packs.append(pack_info)
            print(f"✅ 成功加载: {folder_path.name} ({pack_info.info['skin_count']} 皮肤)")
            return True
            
        except Exception as e:
            print(f"❌ 加载失败: {folder_path.name} - {e}")
            return False
    
    def merge_skin_packs(self) -> Dict:
        """合并所有加载的皮肤包"""
        if not self.loaded_packs:
            raise ValueError("没有加载任何皮肤包")
        
        print("\n🔄 开始合并皮肤包...")
        
        # 初始化合并结果
        merged_skins = {
            'skins': [],
            'serialize_name': self.package_name,
            'localization_name': self.display_name
        }
        
        merged_geometry = {
            'format_version': '1.12.0',
            'minecraft:geometry': []
        }
        
        texture_files = {}
        other_files = {}
        
        # 跟踪重复项
        existing_skin_names = set()
        existing_geometry_ids = set()
        all_pack_names = []
        
        total_skins = 0
        total_geometries = 0
        
        for i, pack in enumerate(self.loaded_packs):
            print(f"📦 处理: {pack.folder_name} ({i + 1}/{len(self.loaded_packs)})")
            
            all_pack_names.append(pack.info['serialize_name'])
            
            # 处理皮肤
            skins = pack.skin_data.get('skins', [])
            for skin in skins:
                skin_copy = json.loads(json.dumps(skin))  # 深拷贝
                skin_name = skin_copy.get('localization_name', 'unknown')
                
                # 处理重复的皮肤名称
                if skin_name in existing_skin_names:
                    counter = 2
                    new_name = f"{skin_name}_{counter}"
                    while new_name in existing_skin_names:
                        counter += 1
                        new_name = f"{skin_name}_{counter}"
                    skin_copy['localization_name'] = new_name
                    skin_name = new_name
                    print(f"   🔀 重命名皮肤: {skin['localization_name']} -> {new_name}")
                
                existing_skin_names.add(skin_name)
                merged_skins['skins'].append(skin_copy)
                total_skins += 1
            
            # 处理几何模型
            for geo_file in pack.geometry_data:
                converted = GeometryConverter.convert_to_new_format(geo_file['data'])
                if converted and 'minecraft:geometry' in converted:
                    for geometry in converted['minecraft:geometry']:
                        geometry_copy = json.loads(json.dumps(geometry))  # 深拷贝
                        original_id = geometry_copy['description']['identifier']
                        
                        # 处理重复的几何模型ID
                        identifier = original_id
                        if identifier in existing_geometry_ids:
                            counter = 2
                            new_id = f"{identifier}_{counter}"
                            while new_id in existing_geometry_ids:
                                counter += 1
                                new_id = f"{identifier}_{counter}"
                            geometry_copy['description']['identifier'] = new_id
                            identifier = new_id
                            print(f"   🔀 重命名几何模型: {original_id} -> {new_id}")
                        
                        existing_geometry_ids.add(identifier)
                        merged_geometry['minecraft:geometry'].append(geometry_copy)
                        total_geometries += 1
            
            # 收集文件
            for texture_file in pack.texture_files:
                if texture_file.name not in texture_files:
                    texture_files[texture_file.name] = texture_file
            
            for other_file in pack.other_files:
                if other_file.name not in other_files:
                    other_files[other_file.name] = other_file
        
        # 如果没有指定名称，使用合并的包名
        if self.package_name == "MergedSkinPack":
            merged_skins['serialize_name'] = '_'.join(all_pack_names[:3])  # 最多3个包名
        if self.display_name == "合并皮肤包":
            merged_skins['localization_name'] = ' + '.join(all_pack_names[:3])
        
        result = {
            'skins': merged_skins,
            'geometry': merged_geometry,
            'textures': texture_files,
            'others': other_files,
            'stats': {
                'total_skins': total_skins,
                'total_geometries': total_geometries,
                'texture_count': len(texture_files),
                'folder_count': len(self.loaded_packs)
            }
        }
        
        print("✅ 合并完成!")
        return result
    
    def save_as_zip(self, merged_result: Dict, output_path: Path):
        """保存为ZIP文件"""
        print(f"\n📦 生成ZIP文件: {output_path}")
        
        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            # 添加JSON文件
            zf.writestr('skins.json', json.dumps(merged_result['skins'], indent=2, ensure_ascii=False))
            print("   ✅ 添加 skins.json")
            
            if merged_result['geometry']['minecraft:geometry']:
                zf.writestr('geometry.json', json.dumps(merged_result['geometry'], indent=2, ensure_ascii=False))
                print("   ✅ 添加 geometry.json")
            
            # 添加纹理文件
            texture_count = len(merged_result['textures'])
            if texture_count > 0:
                print(f"   📸 添加 {texture_count} 个纹理文件...")
                for i, (filename, filepath) in enumerate(merged_result['textures'].items()):
                    try:
                        zf.write(filepath, filename)
                        if (i + 1) % 10 == 0 or i == texture_count - 1:  # 每10个文件或最后一个显示进度
                            print(f"      进度: {i + 1}/{texture_count}")
                    except Exception as e:
                        print(f"   ⚠️  纹理文件添加失败: {filename} - {e}")
            
            # 添加其他文件
            other_count = len(merged_result['others'])
            if other_count > 0:
                print(f"   📄 添加 {other_count} 个其他文件...")
                for filename, filepath in merged_result['others'].items():
                    try:
                        zf.write(filepath, filename)
                    except Exception as e:
                        print(f"   ⚠️  其他文件添加失败: {filename} - {e}")
        
        file_size = output_path.stat().st_size / (1024 * 1024)
        print(f"✅ ZIP文件生成完成，大小: {file_size:.2f} MB")
    
    def save_json_files(self, merged_result: Dict, output_dir: Path):
        """保存为单独的JSON文件"""
        output_dir.mkdir(exist_ok=True)
        
        # 保存skins.json
        skins_path = output_dir / 'merged_skins.json'
        with open(skins_path, 'w', encoding='utf-8') as f:
            json.dump(merged_result['skins'], f, indent=2, ensure_ascii=False)
        print(f"✅ 保存: {skins_path}")
        
        # 保存geometry.json（如果有几何模型）
        if merged_result['geometry']['minecraft:geometry']:
            geometry_path = output_dir / 'merged_geometry.json'
            with open(geometry_path, 'w', encoding='utf-8') as f:
                json.dump(merged_result['geometry'], f, indent=2, ensure_ascii=False)
            print(f"✅ 保存: {geometry_path}")
        
        print(f"📁 JSON文件保存完成: {output_dir}")


class InteractiveInterface:
    """交互式界面"""
    
    def __init__(self):
        self.merger = SkinPackMerger()
        self.merged_result = None
    
    def show_banner(self):
        """显示程序横幅"""
        print("=" * 60)
        print("   🧱 Minecraft 皮肤包合并工具 (Python版)")
        print("=" * 60)
        print()
    
    def show_main_menu(self):
        """显示主菜单"""
        print("\n📋 主菜单:")
        print("1. 📁 添加皮肤包文件夹")
        print("2. 📋 查看已加载的皮肤包")
        print("3. ⚙️  设置合并选项")
        print("4. 🔄 开始合并")
        print("5. 💾 保存结果")
        print("6. 🗑️  清空已加载列表")
        print("7. 🧹 清屏")
        print("0. ❌ 退出程序")
        print()
    
    def input_folder_path(self):
        """输入文件夹路径"""
        while True:
            print("\n📁 添加皮肤包文件夹")
            print("输入皮肤包文件夹路径 (输入 'q' 返回主菜单):")
            
            folder_input = input("📂 路径: ").strip()
            
            if folder_input.lower() == 'q':
                return
            
            if not folder_input:
                print("❌ 路径不能为空")
                continue
            
            folder_path = Path(folder_input)
            
            if not folder_path.exists():
                print("❌ 文件夹不存在")
                continue
            
            if not folder_path.is_dir():
                print("❌ 路径不是文件夹")
                continue
            
            success = self.merger.load_skin_pack_folder(folder_path)
            if success:
                print(f"✅ 成功添加: {folder_path.name}")
                input("\n按 Enter 继续...")
            else:
                print("❌ 添加失败，请检查文件夹是否包含有效的皮肤包")
                input("\n按 Enter 继续...")
    
    def show_loaded_packs(self):
        """显示已加载的皮肤包"""
        clear_screen()
        print("📋 已加载的皮肤包:")
        print("-" * 60)
        
        if not self.merger.loaded_packs:
            print("❌ 暂无已加载的皮肤包")
        else:
            for i, pack in enumerate(self.merger.loaded_packs, 1):
                info = pack.info
                print(f"\n{i}. 📁 {pack.folder_name}")
                print(f"   包名: {info['serialize_name']}")
                print(f"   显示名: {info['localization_name']}")
                print(f"   皮肤: {info['skin_count']} | 几何模型: {info['geometry_count']} | 纹理: {info['texture_count']} | 其他: {info['other_count']}")
        
        input("\n按 Enter 返回主菜单...")
    
    def configure_settings(self):
        """配置合并设置"""
        clear_screen()
        print("⚙️  合并设置:")
        print("-" * 40)
        print(f"当前包标识符: {self.merger.package_name}")
        print(f"当前显示名称: {self.merger.display_name}")
        print()
        
        # 设置包标识符
        new_package_name = input("📦 输入新的包标识符 (按 Enter 保持当前): ").strip()
        if new_package_name:
            self.merger.package_name = new_package_name
            print(f"✅ 包标识符已更新: {new_package_name}")
        
        # 设置显示名称
        new_display_name = input("🏷️  输入新的显示名称 (按 Enter 保持当前): ").strip()
        if new_display_name:
            self.merger.display_name = new_display_name
            print(f"✅ 显示名称已更新: {new_display_name}")
        
        input("\n按 Enter 返回主菜单...")
    
    def merge_packs(self):
        """合并皮肤包"""
        clear_screen()
        
        if not self.merger.loaded_packs:
            print("❌ 没有已加载的皮肤包，请先添加皮肤包文件夹")
            input("\n按 Enter 返回主菜单...")
            return
        
        try:
            self.merged_result = self.merger.merge_skin_packs()
            
            # 显示统计信息
            stats = self.merged_result['stats']
            print("\n📊 合并统计:")
            print("-" * 30)
            print(f"皮肤数量: {stats['total_skins']}")
            print(f"几何模型: {stats['total_geometries']}")
            print(f"纹理文件: {stats['texture_count']}")
            print(f"源文件夹: {stats['folder_count']}")
            
        except Exception as e:
            print(f"❌ 合并失败: {e}")
        
        input("\n按 Enter 返回主菜单...")
    
    def save_result(self):
        """保存结果"""
        clear_screen()
        
        if not self.merged_result:
            print("❌ 没有可保存的结果，请先进行合并")
            input("\n按 Enter 返回主菜单...")
            return
        
        print("💾 保存选项:")
        print("1. 📦 保存为 ZIP 文件 (完整皮肤包)")
        print("2. 📄 保存为 JSON 文件 (仅配置文件)")
        print("0. 🔙 返回主菜单")
        
        choice = input("\n选择保存方式: ").strip()
        
        if choice == '1':
            self._save_as_zip()
        elif choice == '2':
            self._save_as_json()
        elif choice == '0':
            return
        else:
            print("❌ 无效选择")
            input("\n按 Enter 继续...")
    
    def _save_as_zip(self):
        """保存为ZIP文件"""
        print("\n📦 保存为 ZIP 文件")
        
        # 默认文件名
        default_name = f"{self.merger.package_name}_merged.zip"
        filename = input(f"输入文件名 (按 Enter 使用默认: {default_name}): ").strip()
        
        if not filename:
            filename = default_name
        
        if not filename.endswith('.zip'):
            filename += '.zip'
        
        try:
            output_path = Path(filename)
            self.merger.save_as_zip(self.merged_result, output_path)
            print(f"\n✅ 文件已保存: {output_path.absolute()}")
        except Exception as e:
            print(f"❌ 保存失败: {e}")
        
        input("\n按 Enter 返回主菜单...")
    
    def _save_as_json(self):
        """保存为JSON文件"""
        print("\n📄 保存为 JSON 文件")
        
        # 默认目录名
        default_dir = "merged_output"
        dirname = input(f"输入目录名 (按 Enter 使用默认: {default_dir}): ").strip()
        
        if not dirname:
            dirname = default_dir
        
        try:
            output_dir = Path(dirname)
            self.merger.save_json_files(self.merged_result, output_dir)
            print(f"\n✅ 文件已保存到: {output_dir.absolute()}")
        except Exception as e:
            print(f"❌ 保存失败: {e}")
        
        input("\n按 Enter 返回主菜单...")
    
    def clear_loaded_packs(self):
        """清空已加载的皮肤包"""
        if not self.merger.loaded_packs:
            print("❌ 没有已加载的皮肤包")
        else:
            count = len(self.merger.loaded_packs)
            self.merger.loaded_packs.clear()
            self.merged_result = None
            print(f"✅ 已清空 {count} 个皮肤包")
        
        input("\n按 Enter 返回主菜单...")
    
    def run(self):
        """运行交互式界面"""
        while True:
            clear_screen()
            self.show_banner()
            
            # 显示状态信息
            pack_count = len(self.merger.loaded_packs)
            merge_status = "✅ 已合并" if self.merged_result else "❌ 未合并"
            print(f"📊 状态: 已加载 {pack_count} 个皮肤包 | {merge_status}")
            
            self.show_main_menu()
            
            choice = input("请选择操作 (0-7): ").strip()
            
            if choice == '1':
                self.input_folder_path()
            elif choice == '2':
                self.show_loaded_packs()
            elif choice == '3':
                self.configure_settings()
            elif choice == '4':
                self.merge_packs()
            elif choice == '5':
                self.save_result()
            elif choice == '6':
                self.clear_loaded_packs()
            elif choice == '7':
                clear_screen()
            elif choice == '0':
                print("\n👋 感谢使用 Minecraft 皮肤包合并工具!")
                break
            else:
                print("❌ 无效选择，请输入 0-7")
                input("\n按 Enter 继续...")


def main():
    """主函数"""
    try:
        interface = InteractiveInterface()
        interface.run()
    except KeyboardInterrupt:
        print("\n\n👋 程序被用户中断，再见!")
    except Exception as e:
        print(f"\n❌ 程序发生错误: {e}")
        input("\n按 Enter 退出...")


if __name__ == "__main__":
    main()
