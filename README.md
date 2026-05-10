# Floating Live 插件库

## 插件分类

### 核心插件（core）

为floating-live库提供最基础的功能，注册插件后不应卸载，随附floating-live库提供

- `platform`: 直播平台信息管理
- `room`: 直播间消息监听管理

### 框架插件（framework）

为搭建不同floating-live应用程序框架提供基本功能，注册插件后不应卸载

- `snapshot`: 快照状态获取，通常用于前后端分离场景下的插件状态获取

以下插件目前在floating-live-gui提供

- `electronGui`: 提供 Electron GUI 功能
- `config`: 管理并储存应用和插件配置
- `server`: 服务器插件
- `storage`: 存储插件，提供本地存储功能
- `authSave`: 存储用户登录凭据

### 功能插件

为应用程序库提供拓展功能，通常情况下在注册插件后可以卸载

#### 平台插件

- `acfun`: AcFun直播平台监听
- `bilibili`: bilibili直播平台监听

#### 辅助插件

- `auth`: 提供用户登录功能
- `consoleEvent`: 将基础事件输出到控制台上
- `consoleMessage`: 将直播间消息输出到控制台上
- `save`: 将消息保存到本地

## 相关链接

- Floating Live 核心库: https://github.com/Minteea/floating-live
- Floating Live GUI: https://github.com/Minteea/floating-live-gui
