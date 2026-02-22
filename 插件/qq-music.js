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
function getApiConfig() {
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

    // 强校验密码是否正确 (你可以在这里修改你实际想要的密码字符串)
    const CORRECT_PASSWORD = "xiaochen";

    if (password !== CORRECT_PASSWORD) {
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
    const { apiHost } = getApiConfig();

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
    const { apiHost } = getApiConfig();

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
    const { apiHost } = getApiConfig();

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
    const { apiHost } = getApiConfig();

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
 * 获取推荐歌单
 */
async function getRecommendPlaylists(page) {
    const { apiHost } = getApiConfig();

    // 内置一些 QQ 音乐热门歌单的 dissid 作为推荐
    const recommendIds = [
        "7039749142", // 百听不厌的周杰伦
        "8558778401", // 2024抖音爆款热歌
        "9064719532", // 华语精选
        "8470129712", // 流行前线
        "8385078519", // KTV必点
        "8235288591", // 伤感流行
        "9153942295", // 纯音乐推荐
        "8492080388"  // 网络热歌
    ];

    if (page > 1) {
        return { isEnd: true, data: [] };
    }

    try {
        const playlists = [];
        // 为了避免并发太多，我们一次性获取前几个或者串行获取
        for (const id of recommendIds) {
            const requestUrl = `${apiHost}/playlist`;
            const response = await axios.get(requestUrl, {
                params: { id: id },
                ...axiosConfig
            });
            const result = response.data;
            if (result && result.code === 200 && result.data && result.data.playlist) {
                const p = result.data.playlist;
                playlists.push({
                    id: String(p.dissid || id),
                    title: p.dissname || "未知歌单",
                    artist: p.creator || "未知",
                    artwork: p.imgurl || "",
                    playCount: p.listennum ? String(p.listennum).replace(/[^0-9.]/g, '') * 10000 : 0
                });
            }
        }

        return {
            isEnd: true,
            data: playlists
        };
    } catch (error) {
        console.error(`[小Q音乐] 获取推荐歌单失败: ${error.message}`);
        return { isEnd: true, data: [] };
    }
}

/**
 * 获取榜单分类
 */
async function getTopLists() {
    getApiConfig(); // 验证密码

    // QQ音乐官方榜单（提取一些热门的榜单作为固定歌单返回）
    // 榜单本质上也可以看作特定的歌单ID，这里我们找几个有代表性的QQ音乐榜单对应的内部歌单ID，或者直接用固定的流行歌单代替榜单
    const official = [
        { id: "8352611746", name: "QQ音乐热歌榜", description: "QQ音乐官方热歌排行榜", coverImgUrl: "https://y.qq.com/music/photo_new/T002R300x300M000001J5QJL1pRQYB_1.jpg" },
        { id: "8886915065", name: "QQ音乐新歌榜", description: "QQ音乐官方新歌排行榜", coverImgUrl: "https://y.qq.com/music/photo_new/T002R300x300M000002FkS1M0p5g0M_1.jpg" },
        { id: "8528532450", name: "QQ音乐流行指数榜", description: "QQ音乐官方流行指数排行榜", coverImgUrl: "https://y.qq.com/music/photo_new/T002R300x300M000001fXNE00g0L0h_1.jpg" },
        { id: "8134769931", name: "QQ音乐网络歌曲榜", description: "QQ音乐官方网络歌曲排行榜", coverImgUrl: "https://y.qq.com/music/photo_new/T002R300x300M000004cKX0M0tK1h_1.jpg" }
    ];

    const officialFormatted = official.map(toplist => ({
        type: "3", // type为3表示榜单
        id: String(toplist.id),
        title: toplist.name,
        coverImg: toplist.coverImgUrl,
        artist: "QQ音乐官方",
        description: toplist.description,
        worksNum: 100
    }));

    return [
        {
            title: "QQ音乐排行榜",
            data: officialFormatted
        }
    ];
}

/**
 * 获取榜单详情 (复用歌单详情)
 */
async function getTopListDetail(topListItem) {
    try {
        console.log(`[小Q音乐] 获取榜单详情: ${topListItem.title}`);
        const res = await getMusicSheetInfo(topListItem, 1);

        return {
            topListItem: {
                id: res.sheetItem.id,
                title: res.sheetItem.title,
                name: res.sheetItem.title,
                coverImg: res.sheetItem.artwork,
                type: "3",
                artist: res.sheetItem.artist,
                description: res.sheetItem.description
            },
            musicList: res.musicList || [],
            tracks: res.musicList || [],
            isEnd: true
        };
    } catch (error) {
        console.error("[小Q音乐] 获取榜单详情失败:", error.message);
        throw error;
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
    getRecommendPlaylists: getRecommendPlaylists,
    getTopLists: getTopLists,
    getTopListDetail: getTopListDetail
};
