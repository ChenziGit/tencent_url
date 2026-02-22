/**
 * MusicFree 小Q音乐插件
 * 基于自建 QQ 音乐 API 实现搜索、播放、歌词等功能
 * 作者: 小橙QQ群1077835447
 * 更新时间: 2026年02月22日
 *
 * @author MusicFree Plugin
 * @version 1.0.0
 */

const axios = require("axios");
const he = require("he");
const CryptoJs = require("crypto-js");

// 全局 Axios 配置
const axiosConfig = {
    timeout: 30000,
    validateStatus: function (status) {
        return status >= 200 && status < 600;
    }
};

/**
 * 验证密码并获取 API 基础地址
 * 从 userVariables 中读取配置
 */
async function getApiConfig() {
    let apiHost = "http://121.196.228.123:5122"; // 默认后台地址
    let password = "";

    if (typeof env !== "undefined") {
        try {
            const userVars = env.getUserVariables();
            if (userVars) {
                password = userVars.plugin_password || "";
            }
        } catch (e) { }
    }

    // 从 PHP 接口获取正确的密码
    const passwordApiUrl = "http://121.196.228.123:5123/api.php";
    let correctPassword = null;

    try {
        const response = await axios.get(passwordApiUrl, { ...axiosConfig, timeout: 5000 });
        if (response.data && response.data.code === 200 && response.data.data) {
            correctPassword = response.data.data.password;
        }
    } catch (e) {
        console.error(`[小Q音乐] 密码接口请求失败: ${e.message}`);
        throw new Error("无法连接到密码验证服务器，请稍后再试。");
    }

    if (!correctPassword) {
        throw new Error("密码验证服务器返回异常，无法获取验证数据。");
    }

    if (password !== correctPassword) {
        throw new Error("密码错误！请在插件设置中输入正确的访问密码。");
    }

    return { apiHost };
}

/**
 * 格式化 API 返回的歌曲列表为 MusicFree 需要的结构
 */
function formatMusicItem(song) {
    return {
        id: String(song.songmid || song.id),
        title: song.songname || song.name || "未知歌曲",
        artist: song.singer || "未知歌手",
        album: song.albumname || song.album || "未知专辑",
        artwork: song.pic || "", // 封面如果有的话
        url: song.url
    };
}

/**
 * 格式化 API 返回的歌单列表为 MusicFree 需要的结构
 */
function formatPlaylistItem(playlist) {
    return {
        id: String(playlist.dissid),
        title: playlist.dissname,
        artist: playlist.creator,
        artwork: playlist.imgurl,
        worksNum: playlist.song_count || 0,
        playCount: playlist.listennum ? String(playlist.listennum).replace(/[^0-9.]/g, '') * 10000 : 0 // 粗略转换亿/万
    };
}

/**
 * 搜索音乐/歌单
 */
async function search(query, page, type) {
    // 权限与配置校验
    const { apiHost } = await getApiConfig();

    try {
        if (type === "music") {
            const url = `${apiHost}/search`;
            const response = await axios.get(url, {
                params: {
                    keyword: query,
                    page: page,
                    limit: 20
                },
                ...axiosConfig
            });

            const result = response.data;
            if (result && result.code === 200) {
                const songs = result.data || [];
                return {
                    isEnd: songs.length < 20,
                    data: songs.map(formatMusicItem)
                };
            }
        } else if (type === "sheet") {
            const url = `${apiHost}/search/playlist`;
            const response = await axios.get(url, {
                params: {
                    keyword: query,
                    page: page,
                    limit: 20
                },
                ...axiosConfig
            });

            const result = response.data;
            if (result && result.code === 200) {
                const playlists = result.data || [];
                return {
                    isEnd: playlists.length < 20,
                    data: playlists.map(formatPlaylistItem)
                };
            }
        }
        return { isEnd: true, data: [] };
    } catch (error) {
        console.error(`[小Q音乐] 搜索失败: ${error.message}`);
        // 可以直接把错误抛出，在客户端上显示
        throw error;
    }
}

/**
 * 获取媒体源（播放链接/音质详情）
 */
async function getMediaSource(musicItem, quality) {
    const { apiHost } = await getApiConfig();

    try {
        // 请求后台的 /song 接口，注意我们的后台接收的参数通常是 QQ 音乐链接 url
        // 但这里我们传递 songmid 直接拼凑一个假的 url 让后端识别
        const mockUrl = `https://y.qq.com/n/ryqq/songDetail/${musicItem.id}`;
        const requestUrl = `${apiHost}/song`;

        const response = await axios.get(requestUrl, {
            params: { url: mockUrl },
            ...axiosConfig
        });

        const result = response.data;
        if (result && result.code === 200 && result.data && result.data.music_urls) {
            const urls = result.data.music_urls;

            // 将不同梯度的 quality 映射到后台支持的格式中
            // ["standard", "high", "super", "flac"]
            let targetType = '128';
            if (quality === 'flac') {
                targetType = 'flac';
            } else if (quality === 'super' || quality === 'high') {
                targetType = '320';
            } else {
                targetType = '128';
            }

            // 有时候高音质是没有的，如果没有要求的高音质就降级
            let urlInfo = urls[targetType];
            if (!urlInfo) urlInfo = urls['320'];
            if (!urlInfo) urlInfo = urls['128'];
            if (!urlInfo) urlInfo = urls['aac_96'];

            if (urlInfo && urlInfo.url) {
                return {
                    url: urlInfo.url,
                    quality: quality,
                    bitRate: urlInfo.bitrate ? parseInt(urlInfo.bitrate) : 0
                };
            }
        }
        return null;
    } catch (error) {
        console.error(`[小Q音乐] 获取音频失败: ${error.message}`);
        return null;
    }
}

/**
 * 获取歌词
 */
async function getLyric(musicItem) {
    const { apiHost } = await getApiConfig();

    try {
        const mockUrl = `https://y.qq.com/n/ryqq/songDetail/${musicItem.id}`;
        const requestUrl = `${apiHost}/song`;

        const response = await axios.get(requestUrl, {
            params: { url: mockUrl },
            ...axiosConfig
        });

        const result = response.data;
        if (result && result.code === 200 && result.data && result.data.lyric) {
            const lyricData = result.data.lyric;
            return {
                rawLrc: lyricData.lyric || "",
                translation: lyricData.tylyric || ""
            };
        }

        return { rawLrc: "" };
    } catch (error) {
        console.error(`[小Q音乐] 获取歌词失败: ${error.message}`);
        return { rawLrc: "" };
    }
}

/**
 * 获取歌单详情
 */
async function getMusicSheetInfo(sheetItem, page) {
    const { apiHost } = await getApiConfig();

    try {
        const requestUrl = `${apiHost}/playlist`;
        const response = await axios.get(requestUrl, {
            params: { id: sheetItem.id },
            ...axiosConfig
        });

        const result = response.data;
        if (result && result.code === 200 && result.data) {
            const playlistInfo = result.data.playlist || {};
            const songs = result.data.songs || [];

            return {
                isEnd: true,
                sheetItem: {
                    id: String(playlistInfo.dissid || sheetItem.id),
                    title: playlistInfo.dissname || sheetItem.title || "未知歌单",
                    artist: playlistInfo.creator || "未知",
                    artwork: playlistInfo.imgurl || sheetItem.artwork || "",
                    description: playlistInfo.desc || "",
                    worksNum: playlistInfo.song_count || songs.length,
                    playCount: playlistInfo.listennum ? String(playlistInfo.listennum).replace(/[^0-9.]/g, '') * 10000 : 0
                },
                musicList: songs.map(formatMusicItem)
            };
        }
        return { isEnd: true, musicList: [] };
    } catch (error) {
        console.error(`[小Q音乐] 获取歌单详情失败: ${error.message}`);
        return { isEnd: true, musicList: [] };
    }
}

/**
 * 获取榜单分类
 */
async function getTopLists() {
    await getApiConfig(); // 验证密码

    try {
        const payload = {
            "comm": {
                "g_tk": 5381,
                "uin": 0,
                "format": "json",
                "inCharset": "utf-8",
                "outCharset": "utf-8",
                "notice": 0,
                "platform": "h5",
                "needNewCode": 1,
                "ct": 23,
                "cv": 0
            },
            "topList": {
                "module": "musicToplist.ToplistInfoServer",
                "method": "GetAll",
                "param": {}
            }
        };

        const list = await axios.post("https://u.y.qq.com/cgi-bin/musicu.fcg", payload, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                Cookie: "uin=",
            }
        });

        return list.data.topList.data.group.map((e) => ({
            title: e.groupName,
            data: e.toplist.map((_) => ({
                id: _.topId,
                description: _.intro,
                title: _.title,
                period: _.period,
                coverImg: _.headPicUrl || _.frontPicUrl,
            })),
        }));
    } catch (e) {
        console.error("[小Q音乐] 获取榜单失败:", e);
        return [];
    }
}

/**
 * 获取榜单详情
 */
async function getTopListDetail(topListItem) {
    await getApiConfig();
    try {
        const period = topListItem.period || "";
        const payload = {
            "comm": {
                "ct": 24,
                "cv": 0
            },
            "detail": {
                "module": "musicToplist.ToplistInfoServer",
                "method": "GetDetail",
                "param": {
                    "topId": parseInt(topListItem.id),
                    "offset": 0,
                    "num": 100,
                    "period": period
                }
            }
        };

        const res = await axios.post("https://u.y.qq.com/cgi-bin/musicu.fcg", payload, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                Cookie: "uin=",
            }
        });

        let musicList = [];
        if (res.data && res.data.detail && res.data.detail.data && res.data.detail.data.songInfoList) {
            musicList = res.data.detail.data.songInfoList.map(song => Object.assign(Object.assign({}, formatMusicItem(song)), { rawLrcTxt: undefined }));
        }

        return Object.assign(Object.assign({}, topListItem), {
            musicList: musicList,
        });
    } catch (error) {
        console.error("[小Q音乐] 获取榜单详情失败:", error.message);
        throw error;
    }
}

/**
 * 获取推荐歌单标签
 */
async function getRecommendSheetTags() {
    await getApiConfig(); // 验证密码
    try {
        const res = (
            await axios.get(
                "https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_tag_conf.fcg?format=json&inCharset=utf8&outCharset=utf-8",
                {
                    headers: {
                        referer: "https://y.qq.com/",
                    },
                }
            )
        ).data.data.categories;
        const data = res.slice(1).map((_) => ({
            title: _.categoryGroupName,
            data: _.items.map((tag) => ({
                id: tag.categoryId,
                title: tag.categoryName,
            })),
        }));
        const pinned = [];
        for (let d of data) {
            if (d.data.length) {
                pinned.push(d.data[0]);
            }
        }
        return {
            pinned,
            data,
        };
    } catch (e) {
        console.error("[小Q音乐] 获取推荐歌单标签失败:", e);
        return { pinned: [], data: [] };
    }
}

/**
 * 根据标签获取推荐歌单
 */
async function getRecommendSheetsByTag(tag, page) {
    await getApiConfig(); // 验证密码
    try {
        const pageSize = 20;
        const rawRes = (
            await axios.get(
                "https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg",
                {
                    headers: {
                        referer: "https://y.qq.com/",
                    },
                    params: {
                        inCharset: "utf8",
                        outCharset: "utf-8",
                        sortId: 5,
                        categoryId: (tag === null || tag === void 0 ? void 0 : tag.id) || "10000000",
                        sin: pageSize * (page - 1),
                        ein: page * pageSize - 1,
                    },
                }
            )
        ).data;
        const res = JSON.parse(
            rawRes.replace(/callback\(|MusicJsonCallback\(|jsonCallback\(|\)$/g, "")
        ).data;
        const isEnd = res.sum <= page * pageSize;
        const data = res.list.map((item) => {
            var _a, _b;
            return {
                id: String(item.dissid),
                createTime: item.createTime,
                title: item.dissname,
                artwork: item.imgurl,
                description: item.introduction,
                playCount: item.listennum,
                artist: (_b = (_a = item.creator) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "",
            };
        });
        return {
            isEnd,
            data,
        };
    } catch (e) {
        console.error("[小Q音乐] 分类获取歌单失败:", e);
        return { isEnd: true, data: [] };
    }
}

module.exports = {
    platform: "小Q音乐",
    author: "小橙QQ群1077835447",
    version: "1.0.0",
    cacheControl: "no-store",
    // 强制使用配置以校验密码
    userVariables: [
        {
            key: "plugin_password",
            name: "插件访问密码 (必填)",
            hint: "输入正确密码后方可使用插件所有功能"
        }
    ],
    description: "## 小Q音乐 v1.0.0\n\n🎉 **功能说明**\n- ✅ 支持歌曲、歌单搜索\n- ✅ 支持获取无损音频与普通音频\n- ✅ 支持同步显示双语歌词\n- 🔒 **首次导入请前往设置中配置访问密码。**",
    hints: {
        importMusicItem: [
            "QQ音乐：APP点击分享，然后复制链接"
        ]
    },
    supportedSearchType: ["music", "sheet"],
    supportedGetMediaSourceQuality: [
        "standard",   // 标准音质
        "high",       // 高音质
        "super",      // 极高音质
        "flac"        // 无损音质
    ],
    search: search,
    getMediaSource: getMediaSource,
    getLyric: getLyric,
    getPlaylistDetail: getMusicSheetInfo,
    getMusicSheetInfo: getMusicSheetInfo,
    getRecommendSheetTags: getRecommendSheetTags,
    getRecommendSheetsByTag: getRecommendSheetsByTag,
    getTopLists: getTopLists,
    getTopListDetail: getTopListDetail
};
