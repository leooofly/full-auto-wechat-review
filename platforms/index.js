'use strict';

const path = require('path');
const os = require('os');

const wechatDownload = require('../scrapers/wechat/download');
const wechatLogin = require('../scrapers/wechat/login');
const wechatParser = require('../scrapers/wechat/parser');

const xhsDownload = require('../scrapers/xiaohongshu/download');
const xhsLogin = require('../scrapers/xiaohongshu/login');
const xhsParser = require('../scrapers/xiaohongshu/parser');

const platforms = {
  wechat: {
    id: 'wechat',
    profileDir: path.join(os.homedir(), '.wechat-review'),
    getLatestFiles: wechatDownload.getLatestFiles,
    login: wechatLogin.login,
    downloadData: wechatDownload.downloadData,
    parseFiles: wechatParser.parseFiles,
  },
  xiaohongshu: {
    id: 'xiaohongshu',
    profileDir: path.join(os.homedir(), '.xiaohongshu-review'),
    getLatestFiles: xhsDownload.getLatestFiles,
    login: xhsLogin.login,
    downloadData: xhsDownload.downloadData,
    parseFiles: xhsParser.parseFiles,
  },
};

function getPlatform(platformId) {
  const platform = platforms[platformId || 'wechat'];
  if (!platform) {
    throw new Error(`Unsupported platform: ${platformId}`);
  }
  return platform;
}

module.exports = { platforms, getPlatform };
