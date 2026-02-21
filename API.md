# QQ Music 综合解析 API 文档

本 API 是基于 Python Flask 构建的本地/服务器端 QQ 音乐解析服务。通过调用封装好的内部接口，实现了从指定的 QQ 音乐单曲链接提取真实的歌曲详情、所有音质规格的真实播放链接、歌词数据；并且支持通过歌曲名、歌手名搜索歌曲及歌单数据。

---

## 基础信息

- **默认协议**：`HTTP`
- **默认请求地址**：`http://127.0.0.1:5122` (本地运行环境下)
- **请求格式**：`application/x-www-form-urlencoded` 或直接 `Query/GET`
- **响应格式**：`application/json`

### 全局统一返回结构

无论是成功返回数据还是报错，接口都将严格返回以下统一格式：

```json
{
    "code": 200,      // 状态码：200(成功), 400(缺少参数/网址错误), 404(歌曲不存在/Cookie过期)
    "msg": "success", // 提示信息：success 或具体的错误消息
    "data": { ... }   // 实际响应体。报错时此值为 null 或者是 []
}
```

---

## 1. 歌曲播放链接及详情解析

根据用户传入的 QQ 音乐分享链接，解析这首歌的全部数据（专辑信息、无损播放地址、逐字歌词等）。

- **接口地址**：`/song`
- **请求方式**：`GET`

### 请求参数

| 参数名 | 必选 | 类型 | 说明 |
| :--- | :---: | :--- | :--- |
| `url` | **是** | `string` | 单曲详情分享链接，例如：`https://y.qq.com/n/ryqq/songDetail/0039MnYb0qxYhV` |

> **提示**：链接中务必包含 `songDetail/` 后面的唯一识别码（也就是 `songmid` 或者 `id`）。

### 成功响应示例 (200)

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "song": {
      "name": "晴天",
      "album": "叶惠美",
      "singer": "周杰伦",
      "pic": "https://y.qq.com/music/photo_new/T002R800x800M000000MkMni19ClKG.jpg?max_age=2592000",
      "mid": "0039MnYb0qxYhV",
      "id": 97773
    },
    "lyric": {
      "lyric": "[ti:晴天]\n[ar:周杰伦]\n[al:叶惠美]\n[by:QQ音乐]...", // 原文歌词
      "tylyric": "" // 翻译歌词（如果有的话）
    },
    "music_urls": {
      "320": {
        "url": "https://wqweqp.stream.qqmusic.qq.com/M8000039MnYb0qxYhV.mp3?guid=10000&...",
        "bitrate": "320kbps"
      },
      "128": {
        "url": "https://wqweqp.stream.qqmusic.qq.com/M5000039MnYb0qxYhV.mp3?guid=10000&...",
        "bitrate": "128kbps"
      }
      // 还可能包含更多无损音质例如: aac_192, ogg_320, ogg_640, flac等
    }
  }
}
```

### 错误响应示例

**参数缺失 (400)**:
```json
{
    "code": 400,
    "msg": "url parameter is required",
    "data": null
}
```

**歌曲不存在或已被官方下架 (404)**:
```json
{
    "code": 404,
    "msg": "信息获取错误/歌曲不存在或Cookie已过期",
    "data": null
}
```

---

## 2. 歌曲原生搜索

利用 QQ 音乐搜索接口，通过包含歌曲名称、相关歌手或任意关键词，获取一组包含明确 `songmid` 的搜索结构。

- **接口地址**：`/search`
- **请求方式**：`GET`

### 请求参数

| 参数名 | 必选 | 类型 | 说明 |
| :--- | :---: | :--- | :--- |
| `keyword` | **是** | `string` | 搜索关键词（歌曲名称或歌手名称等） |
| `page` | 否 | `int` | 指定获取的页码 (默认: `1`) |
| `limit` | 否 | `int` | 指定每页返回的详细条目数量 (默认: `10`) |

### 返回结构及示例

```json
{
  "code": 200,
  "msg": "success",
  "data": [
    {
      "songmid": "0039MnYb0qxYhV",
      "songname": "晴天",
      "singer": "周杰伦",
      "albumname": "叶惠美",
      "url": "https://y.qq.com/n/ryqq/songDetail/0039MnYb0qxYhV"
    },
    {
      "songmid": "003aAYrm3GE0Ac",
      "songname": "稻香",
      "singer": "周杰伦",
      "albumname": "魔杰座",
      "url": "https://y.qq.com/n/ryqq/songDetail/003aAYrm3GE0Ac"
    }
    // ... 更多相关的歌曲搜索结果条目
  ]
}
```

---

## 3. 歌单原生搜索

利用专门的业务接口，通过相关关键词在海量的 QQ 用户生成的“公开歌单”内进行搜素。

- **接口地址**：`/search/playlist`
- **请求方式**：`GET`

### 请求参数

| 参数名 | 必选 | 类型 | 说明 |
| :--- | :---: | :--- | :--- |
| `keyword` | **是** | `string` | 搜索关键词（歌单名或相关的歌手名） |
| `page` | 否 | `int` | 指定获取的页码 (默认: `1`) |
| `limit` | 否 | `int` | 指定每页返回的详细条目数量 (默认: `10`) |

### 返回结构及示例

```json
{
  "code": 200,
  "msg": "success",
  "data": [
    {
      "dissid": "7039749142",
      "dissname": "百听不厌的周杰伦",
      "creator": "今晚月色很美",
      "imgurl": "http://qpic.y.qq.com/music_cover/0cthhV0GM91g.../300?n=1", // 歌单封面图片
      "song_count": 99, // 此歌单内包含的单曲总数
      "listennum": "3.9亿" // 人气/总计播放量
    },
    {
      "dissid": "2308475533",
      "dissname": "我落泪情绪零碎，周杰伦",
      "creator": "1946 。",
      "imgurl": "http://qpic.y.qq.com/music_cover/xy585mIRLoGjBb.../300?n=1",
      "song_count": 34,
      "listennum": "5198.2万"
    }
  ]
}
```

---

## 注意事项

- `/song` 参数解析强依赖于 `app.py` 中硬编码的 `cookie_str`。如果您遇到频繁报 `404` （尤其是带有 “信息获取错误/歌曲不存在或Cookie已过期” 的报错），表明服务端判定您的 Cookie 存在问题导致权限不足。请更新脚本中最新提取的您的真实网页版 QQ 音乐 Cookie。
- 对于 `flac`、`master` 甚至 `128kbps` 的真实物理流媒体，普通非 VIP 账号是无权拿取到真实 URL 的（当判断无权时返回空或不包含在 `music_urls` 列表中）。
- `/search` 和 `/search/playlist` 作为公共搜索 API 暂不强依赖 Cookie，但会受制于主服务器常规反爬拦截限制。建议部署上线后配合防封禁策略或轮询处理请求以确保更佳的稳定性。
