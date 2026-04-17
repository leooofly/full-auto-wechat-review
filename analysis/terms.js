'use strict';

function getPlatformTerms(input) {
  const platform = typeof input === 'string'
    ? input
    : (input && input.platform) || 'wechat';

  if (platform === 'xiaohongshu') {
    return {
      platform,
      platformName: '小红书',
      accountLabel: '小红书账号',
      contentLabel: '笔记',
      contentLabelPlural: '笔记',
      readerLabel: '曝光/阅读',
      readersShortLabel: '曝光',
      audienceLabel: '粉丝',
      channelLabel: '流量来源',
      reportEyebrow: '小红书数据分析报告',
      reportTitle: '小红书数据分析报告',
      footerProduct: 'Xiaohongshu Review',
    };
  }

  return {
    platform: 'wechat',
    platformName: '微信公众号',
    accountLabel: '公众号',
    contentLabel: '文章',
    contentLabelPlural: '文章',
    readerLabel: '阅读',
    readersShortLabel: '阅读',
    audienceLabel: '粉丝',
    channelLabel: '渠道',
    reportEyebrow: '公众号数据分析报告',
    reportTitle: '公众号数据分析报告',
    footerProduct: 'WeChat Review',
  };
}

module.exports = { getPlatformTerms };
