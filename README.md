# Minecraft 皮肤包合并工具

<div align="center">

![Minecraft Logo](https://img.shields.io/badge/Minecraft-62B47A?style=for-the-badge&logo=minecraft&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

**一个专业的 Minecraft 基岩版皮肤包合并解决方案**

[在线体验](#) • [报告问题](../../issues) • [功能请求](../../issues)

</div>

---

## 📖 项目简介

Minecraft 皮肤包合并工具是一个基于 Web 的应用程序，专门为 Minecraft 基岩版设计，帮助玩家和开发者轻松合并多个皮肤包。该工具提供直观的用户界面，支持拖拽操作，能够智能处理皮肤冲突和几何模型重复问题。

## 🚀 快速开始

### 系统要求

- **浏览器**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+
- **设备**: 桌面设备（推荐）
- **内存**: 建议 4GB+ RAM（处理大型皮肤包时）

## 📋 使用教程

### 第一步：加载皮肤包

#### 方式一：拖拽文件夹
1. 将包含多个皮肤包的文件夹直接拖拽到上传区域
2. 工具会自动识别并分析每个子文件夹中的皮肤包

#### 方式二：选择文件夹
1. 点击"选择文件夹"按钮
2. 在弹出的对话框中选择包含皮肤包的文件夹

#### 方式三：选择单个文件
1. 点击"选择文件"按钮
2. 选择 `skins.json` 或几何模型文件

### 第二步：配置合并设置

在右侧设置面板中配置以下选项：

- **包标识符**: 合并后皮肤包的唯一标识符（默认：MergedSkinPack）
- **显示名称**: 在游戏中显示的皮肤包名称（默认：合并皮肤包）
- **下载格式**: 
  - 完整包 (ZIP): 包含所有文件的完整皮肤包
  - 仅配置文件: 只下载JSON配置文件

### 第三步：开始合并

1. 确认所有皮肤包都已正确加载
2. 检查设置配置是否正确
3. 点击"开始合并"按钮
4. 等待处理完成，观察进度条和状态信息

### 第四步：下载结果

合并完成后：
1. 查看合并统计信息
2. 点击"下载结果"按钮
3. 根据选择的格式下载文件

---

### 核心类说明

#### `SkinPackMerger`
主控制器类，负责：
- 文件上传和处理
- 用户界面管理
- 进度跟踪和状态更新
- 结果下载

#### `CompleteSkinPackMerger`
合并引擎类，负责：
- 皮肤数据合并
- 几何模型处理和转换
- 冲突检测和解决
- 文件打包

---

## ⚙️ 配置选项

### 皮肤包设置

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `serialize_name` | String | "MergedSkinPack" | 皮肤包标识符 |
| `localization_name` | String | "合并皮肤包" | 显示名称 |

### 下载选项

| 选项 | 描述 | 输出文件 |
|------|------|----------|
| 完整包 (ZIP) | 包含所有文件的压缩包 | `{包名}_merged.zip` |
| 仅配置文件 | 只下载JSON配置 | `merged_skins.json`, `merged_geometry.json` |

---

## 🔧 高级功能

### 几何模型格式转换

工具自动检测并转换旧版几何模型格式：

```javascript
// 旧格式
{
  "geometry.player": {
    "texturewidth": 64,
    "textureheight": 64,
    "bones": [...]
  }
}

// 转换为新格式
{
  "format_version": "1.12.0",
  "minecraft:geometry": [{
    "description": {
      "identifier": "geometry.player",
      "texture_width": 64,
      "texture_height": 64
    },
    "bones": [...]
  }]
}
```

### 冲突处理机制

- **皮肤名称冲突**: 自动添加数字后缀（如：`skin_name_2`）
- **几何模型ID冲突**: 智能重命名保持唯一性
- **文件名冲突**: 优先保留第一个文件，后续重复文件跳过

---

## 🐛 故障排除

### 常见问题

#### 1. 文件加载失败
**症状**: 拖拽文件夹后没有反应
**解决方案**:
- 确保文件夹包含 `skins.json` 文件
- 检查文件编码是否为 UTF-8
- 尝试清理JSON文件中的注释

#### 2. 合并进程卡住
**症状**: 进度条停止或长时间无响应
**解决方案**:
- 刷新页面重新开始
- 检查文件大小，避免处理过大的文件
- 使用浏览器开发者工具查看控制台错误

#### 3. 下载文件损坏
**症状**: 下载的ZIP文件无法打开
**解决方案**:
- 确保浏览器支持 Blob 下载
- 检查可用磁盘空间
- 尝试使用其他浏览器



## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

---

## 🙏 致谢

- [Font Awesome](https://fontawesome.com/) - 图标库
- [JSZip](https://stuk.github.io/jszip/) - JavaScript ZIP 库
- [Google Fonts](https://fonts.google.com/) - Inter 字体

---

