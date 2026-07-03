# C Preprocessor Visualizer

一个用于 VS Code 的 C 语言预处理可视化插件。

它会在编辑 C/C++ 文件时辅助查看条件编译结构：

- 点击 `#if`、`#ifdef`、`#ifndef`、`#elif`、`#else`、`#endif` 指令本身时，高亮同一组预处理指令。
- 对当前未启用的条件编译代码区域使用绿色显示。
- 只处理当前打开并获得焦点的文件，不跨文件解析 `#include`。

## 功能效果

例如：

```c
#define FEATURE_X 1
#define FEATURE_Y 0

#if defined(FEATURE_X)
int feature_x = 1;
#elif defined(FEATURE_Y)
int feature_y = 1;
#else
int no_feature = 1;
#endif
```

当光标点击 `#if`、`#elif`、`#else` 或 `#endif` 这些指令 token 时，插件会把同一组里的预处理指令一起标识出来。

未启用的代码分支会显示为绿色，默认颜色为：

```text
#5ac83cd9
```

## 本地调试

用 VS Code 打开项目目录：

```bash
code .
```

然后按 `F5`，VS Code 会打开一个新的 `Extension Development Host` 窗口。

在新窗口中打开任意 `.c`、`.h`、`.cpp`、`.hpp` 等 C/C++ 文件，点击预处理指令即可查看效果。

注意：需要点击指令本身，比如 `#ifdef` 这几个字符；点击同一行的宏名或空白区域不会触发高亮。

## 运行测试

项目没有额外依赖，直接运行：

```bash
npm test
```

测试内容包括：

- C 预处理指令配对识别。
- `#if/#elif/#else/#endif` 同组高亮。
- `#ifdef/#else/#endif` 同组高亮。
- `#ifndef/#endif` 配对高亮。
- 未启用代码区域识别。
- 简单数值宏判断。

## 当前支持的预处理能力

当前解析器支持：

- `#define`
- `#undef`
- `#if`
- `#ifdef`
- `#ifndef`
- `#elif`
- `#else`
- `#endif`
- `defined(MACRO)`
- 简单数值表达式，例如：

```c
#define FEATURE_Y 0
#define TARGET_LEVEL 2

#if defined(FEATURE_X) && TARGET_LEVEL >= 2
```

## 当前限制

这个插件不是完整 C 预处理器，目前有这些限制：

- 不解析 `#include` 引入的其他文件。
- 不读取编译器参数中的 `-D` 宏。
- 不支持复杂宏展开。
- 函数式宏会按已定义处理，但不会执行宏展开。
- 只根据当前文件从上到下的宏定义状态判断条件分支。

这些限制是刻意保守的：插件优先用于编辑器里的快速视觉辅助，而不是替代编译器预处理结果。

## 项目结构

```text
extension.js
  VS Code 插件入口，负责编辑器事件、装饰器和缓存。

parser.js
  C 预处理结构解析器，负责判断分支关系和 inactive 区域。

c-preprocessor-visualizer-tests/
  插件核心解析逻辑测试。

.vscode/launch.json
  VS Code 扩展调试配置。
```

## 配置项

可以在 VS Code 设置中修改 inactive 区域颜色：

```json
{
  "cPreprocessorVisualizer.inactiveColor": "#5ac83cd9"
}
```
