# AI Trainer 备考练习小程序

上海人社人工智能训练师三级/四级备考刷题小程序。

微信小程序版，基于 [ai-trainer-cert-practice](https://github.com/2bebetter/ai-trainer-cert-practice) 的功能逻辑和交互设计开发。

## 功能

- **理论学习** — 判断/单选/多选练习，提交显示对错和解析
- **模拟考试** — 判断40 + 单选140 + 多选10，限时90分钟
- **实操学习** — 代码填空（占位符编辑）+ 文档作答
- **错题本与复习** — 自动收集错题，反复错和有笔记的题分类复习
- **AI 判题** — 自行提供 API Key，云函数透传调用 LLM 评分
- **数据管理** — 学习数据导出/导入

## 开发

### 前置条件

1. [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 注册微信小程序 AppID

### 启动

```bash
# 克隆项目
git clone git@github.com:2bebetter/ai-cert-weapp.git
cd ai-cert-weapp

# 在微信开发者工具中打开项目目录
# 1. 修改 project.config.json 中的 appid
# 2. 创建云开发环境并关联
# 3. 部署云函数：右键 cloudfunctions/aiGrade → 上传并部署
```

## 数据来源

题库来自 [ai-trainer-cert-practice](https://github.com/2bebetter/ai-trainer-cert-practice) 项目的公开参考题库，不等同于真实考试原题。

## 免责声明

本工具仅为考生备考练习使用，并非人社官方系统。考试请以上海人社官方考核为准。