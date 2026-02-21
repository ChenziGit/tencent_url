# QQ音乐无损解析使用方法
先安装 文件所需要的依赖模块 
pip install -r requirements.txt
再运行app.py文件即可

# 环境要求
Python >= 3

# 请求示例

如图箭头显示

![url链接](https://raw.githubusercontent.com/Suxiaoqinx/tencent_url/refs/heads/main/fe14f9a6-16ca-423d-980b-c17015666dc0.png)

## 参数列表

请求链接选择 http://ip:port/song 

请求方式 GET

|  参数列表  | 参数说明 |
|  ----  | ---- |
| url | 解析获取到的QQ音乐地址|

# 返回数据
song[] = 包含歌名 专辑 歌手 图片
lyric[] = 包含原文歌词 翻译歌词(如果有)
music_urls[] = 包含'm4a', '128', '320', 'flac', 'ape'等歌曲链接
其中flac和ape为无损 320为高品质 m4a和128为标准音质

## 搜索接口 (新增)

请求链接选择 http://ip:port/search 

请求方式 GET

|  参数列表  | 参数说明 |
|  ----  | ---- |
| keyword | 必填，搜索的歌曲名称或歌手 |
| page | 选填，页码，默认为 1 |
| limit | 选填，每页返回数量，默认为 10 |

返回数据格式统一为标准 JSON：
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
    }
  ]
}
```

## 搜索歌单接口 (新增)

请求链接选择 http://ip:port/search/playlist 

请求方式 GET

|  参数列表  | 参数说明 |
|  ----  | ---- |
| keyword | 必填，搜索的歌单名称或相关歌手 |
| page | 选填，页码，默认为 1 |
| limit | 选填，每页返回数量，默认为 10 |

返回数据格式统一为标准 JSON：
```json
{
  "code": 200,
  "msg": "success",
  "data": [
    {
      "dissid": "7039749142",
      "dissname": "百听不厌的周杰伦",
      "creator": "今晚月色很美",
      "imgurl": "http://qpic.y.qq.com/music_cover/.../300?n=1",
      "song_count": 99,
      "listennum": "3.9亿"
    }
  ]
}
```

# 演示站点
[在线解析](https://api.toubiec.cn/qqmusic.html)

# 注意事项
请先在app.py中的cookie_str填写入你从y.qq.com获取到的cookie才可以解析！
其中 要解析VIP歌曲以及无损以上音质 请获取会员账号的cookie

# 反馈方法
请在Github的lssues反馈 或者到我[博客](https://www.toubiec.cn)反馈
