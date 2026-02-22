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
 * 获取榜单分类
 */
async function getTopLists() {
    getApiConfig(); // 验证密码

    try {
        const list = await axios({
            url: "https://u.y.qq.com/cgi-bin/musicu.fcg?_=1577086820633&data=%7B%22comm%22%3A%7B%22g_tk%22%3A5381%2C%22uin%3A123456%2C%22format%22%3A%22json%22%2C%22inCharset%22%3A%22utf-8%22%2C%22outCharset%22%3A%22utf-8%22%2C%22notice%22%3A0%2C%22platform%22%3A%22h5%22%2C%22needNewCode%22%3A1%2C%22ct%22%3A23%2C%22cv%22%3A0%7D%2C%22topList%22%3A%7B%22module%22%3A%22musicToplist.ToplistInfoServer%22%2C%22method%22%3A%22GetAll%22%2C%22param%22%3A%7B%7D%7D%7D",
            method: "get",
            headers: {
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
    try {
        const period = topListItem.period || "";
        const res = await axios({
            url: `https://u.y.qq.com/cgi-bin/musicu.fcg?g_tk=5381&data=%7B%22detail%22%3A%7B%22module%22%3A%22musicToplist.ToplistInfoServer%22%2C%22method%22%3A%22GetDetail%22%2C%22param%22%3A%7B%22topId%22%3A${topListItem.id}%2C%22offset%22%3A0%2C%22num%22%3A100%2C%22period%22%3A%22${period}%22%7D%7D%2C%22comm%22%3A%7B%22ct%22%3A24%2C%22cv%22%3A0%7D%7D`,
            method: "get",
            headers: {
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
    getApiConfig(); // 验证密码
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
