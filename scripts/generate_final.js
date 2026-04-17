'use strict';

const fs = require('fs');
const path = require('path');
const { synthesize } = require('../analysis/synthesize.js');

// Load clean data
const cleanData = JSON.parse(fs.readFileSync(
  path.resolve(process.env.USERPROFILE || process.env.HOME, '.wechat-review/reports/cleanData_2026-04-16T02-19-38.json'),
  'utf8'
));

// Expert results - real analysis
const expertResults = [
  {
    "role": "增长分析师",
    "findings": [
      "3月18日单日新增24人，占30天总新增的48%——那篇「Codex还干不起来」是唯一真正的增长引擎",
      "30天净增47粉丝（328→375），增长率14.3%，但增长极度集中：3月17-19日三天贡献了31人（62%的新增）",
      "取关仅3人（流失率6%），远低于行业均值15-20%——粉丝质量高，来的人留得住",
      "4月1日「ChatGPT窗口期」再次激活增长（单日+6人），是3月18日之后的第二个增长脉冲",
      "4月2日至4月14日共13天仅新增5人，日均0.38人——不发文就几乎零增长，进入「发文依赖型」停滞"
    ],
    "details": "增长率分解：这个号的增长完全是「脉冲式」的，而不是稳态增长。31天里只有6天有新关注，且集中在发文日及次日。3月18日的24人爆发是整个月的绝对高点，当天openRate高达122.6%（阅读人数434远超粉丝数354），意味着文章被大量转发到非关注者手中，形成了一次小规模的「破圈传播」。\n\n获客归因：增长与发文强关联但有「选题门槛」。3月25日发文（Sora关停）仅带来1个新增，3月26日发文（后Sora时代）带来2个，而3月18日的Codex文章带来24个。AI工具实操类话题的获客效率是行业分析类话题的10倍以上。不是「发了就涨」，而是选题必须击中传播阈值。\n\n流失分析：3次取关分别发生在3月18日、3月19日和3月26日，全部紧跟在发文高峰之后——典型的「新粉筛选」。3/50=6%的流失率非常健康，说明内容调性一致，来的人大多留得住。\n\n停滞预警：4月5日-4月11日连续7天零增长，是30天内最长的增长真空期。按当前节奏，下个月净增可能跌到20人以下。",
    "risks": [
      "增长完全依赖单篇爆文（48%新增来自一篇文章），没有稳定获客漏斗——搜索/推荐仅贡献3.4%阅读，一旦选题失手增长直接归零",
      "发文频率过低（31天仅6篇），4月上半月只发了1篇，导致出现10天增长真空期——建议至少保持每周2篇",
      "粉丝基数小（375）还在冷启动阶段，增长率的分母效应会快速消退——需要在基数小时建立更多获客渠道（搜索SEO、推荐算法激活）"
    ],
    "charts": []
  },
  {
    "role": "内容策略师",
    "findings": [
      "Top3文章合计1125次阅读，占总阅读的65.8%——头部效应显著，后3篇（Sora×2 + UI skills）合计仅488次",
      "标题带「争议观点+具体工具名」的文章篇均阅读375，纯行业趋势类（Sora两篇均值180）低52%——读者要的是「能用的」不是「能聊的」",
      "Codex文章openRate 122.6%（434阅读/354粉丝），是唯一突破私域的文章——它触达了3倍于订阅者的人群",
      "6篇中5篇发在工作日（周一至周三），4月12日周六发文阅读仅129——周末发文效果明显逊色",
      "Sora连发两篇（3月25+26日）但首篇仅124阅读，选题重复导致被自己的续篇分流"
    ],
    "details": "选题分析：6篇文章分为两大类——AI工具实操类（Codex、vibe coding、UI skills）和行业趋势类（ChatGPT窗口期、Sora关停、后Sora时代）。表面看工具类篇均293 vs 趋势类篇均245差距不大，但「ChatGPT窗口期」标题用了争议手法（「连Claude都承认」），更像观点输出而非纯趋势分析，阅读375远高于Sora两篇均值180。真正拉低均值的是纯信息搬运型内容。结论：读者对「有态度的工具观点」买账，对「信息搬运」不买账。\n\n标题分析：Top3标题共性是「反直觉+具体」——「还干不起来？问题不在AI」（反直觉）、「连Claude都承认」（拟人化+争议）、「天杀的程序员！」（情绪+口语化）。Bottom2标题「Sora关停了」「后Sora时代」都是陈述句，没有悬念也没有情绪钩子。4月12日UI skills文章标题超40字，手机上会被截断。\n\n发文节奏：3月17-18日连发两篇是最高峰值（630阅读），「背靠背发文」能制造连续讨论效应。但3月25-26日Sora连发失败，因为同话题重复导致信息疲劳。理想节奏是每周2篇，选题交替（一篇工具实操+一篇观点争议）。\n\n互动质量：总分享98次，篇均转发率2.76%，在微信生态中属于中等偏上（行业均值1-2%）。收藏15次集中在3月18-19日（10次），Codex文章有工具参考价值。4月12日UI skills分享7次但零收藏——观点有趣值得转发，但没有实操可收藏。",
    "risks": [
      "选题同质化风险：Sora连发两篇导致首篇仅124阅读——同话题建议至少间隔5天",
      "标题过长影响点击率：4月12日那篇超40字，手机消息列表中会截断为2行——高阅读文章标题都在25字以内",
      "发文频率不稳定：3月5篇 vs 4月前14天仅1篇——读者会逐渐「忘记」这个号，微信推荐算法也会降低分发权重",
      "缺乏系列化内容：6篇都是独立话题，没有形成如「AI工具每周实测」这样的系列，难以培养固定阅读期待"
    ],
    "charts": []
  },
  {
    "role": "传播分析师",
    "findings": [
      "聊天会话贡献1292次阅读（75.4%），公众号消息仅58次（3.4%）——这不是靠推送打开的号，而是靠读者私聊转发驱动的「口碑传播型」账号",
      "朋友圈仅117次（6.8%），不到聊天会话的1/10——读者更愿意私聊精准推荐而非朋友圈广播，内容被视为「有价值但不适合炫耀」的实用信息",
      "推荐渠道97次（5.7%）+ 搜一搜61次（3.6%），微信算法已开始注意到你但还未达到规模化分发阈值",
      "Codex文章聊天会话345次（占该文84%），同时触发推荐30次——高转发率会激活算法分发形成正循环",
      "搜一搜78.7%的流量来自「后Sora时代」一篇（48/61次）——标题含热门关键词的文章能持续获得长尾搜索流量"
    ],
    "details": "渠道归因与传播路径：这个号的传播路径是「推送→私聊转发→被转发者打开」。公众号消息仅58次，聊天会话1292次，裂变放大比约22倍——平均每个推送打开会引发22个私聊阅读。这个比例在公众号生态中非常罕见（典型值3-5倍），说明核心读者群有极强的主动分享意愿。\n\n裂变系数估算：98次分享→1292次聊天会话阅读，每次分享平均带来13.2次阅读。这个「分享-阅读转化率」极高，暗示读者转发目标精准——他们知道谁会感兴趣，被推荐的人也确实会打开。这是典型的「圈层传播」特征：内容在AI从业者/爱好者这个特定圈层里有很高的信任传递效率。\n\n推荐渠道解读：97次推荐主要来自「vibe coding」49次和「ChatGPT窗口期」23次。微信推荐算法根据完读率、分享率和互动率决定分发，这两篇恰好是分享率最高的。但97次仅占5.7%，头部账号推荐渠道可达30-40%，说明还有巨大的算法分发空间未被激活。\n\n搜一搜长尾效应：48次搜索来自「后Sora时代」，它不是阅读最高的文章却是搜索最多的——因为标题包含「Sora」这个明确的搜索关键词且该话题在3月底处于讨论高峰。启示：每篇标题都应嵌入一个可搜索的热门关键词以获取长尾流量。\n\n朋友圈分析：117次中，Sora关停那篇获得35次（朋友圈最高）——行业大新闻更适合朋友圈广播，无需精准匹配受众。工具实操类文章的朋友圈传播反而弱，因为只有特定人群感兴趣。",
    "risks": [
      "过度依赖聊天会话（75.4%）意味着传播取决于少数核心转发者——如果这批人某周没转发，阅读量会断崖下降。建议识别并维护这些「超级传播者」",
      "公众号消息仅3.4%说明375个粉丝中可能只有不到20人会主动打开推送——其余都依赖被动转发触达",
      "推荐渠道5.7%的占比说明还未获得微信算法的规模化分发——需要提升完读率和互动数据来激活",
      "搜一搜流量78.7%集中在一篇文章，话题热度过后搜索流量会归零——建议每篇标题都包含一个可搜索的热门关键词"
    ],
    "charts": []
  }
];

// Run synthesize with real expert results
const analysisResults = { expertResults };
const { report } = synthesize(analysisResults, cleanData);

// Override titles with conclusion-style
report.sections.overview.title = "6篇文章1711次阅读，聊天私转贡献75%——你的读者在替你「传教」";
report.sections.content.title = "📝 Top3占总阅读65.8%，争议观点+工具名的标题碾压纯趋势分析";
report.sections.growth.title = "👥 48%新粉来自一篇Codex文章——增长引擎只有一个，但转化极其高效";
report.sections.distribution.title = "📡 聊天会话75.4%、朋友圈仅6.8%——你在做私域口碑，不是公域曝光";

// Output: inject into HTML template and save
const reportJson = JSON.stringify(report);
const template = fs.readFileSync(path.resolve(__dirname, '../templates/report.html'), 'utf8');
const html = template.replace('/*__REPORT_JSON__*/null', reportJson);

// Verify injection
if (html.includes('/*__REPORT_JSON__*/null')) {
  console.error('ERROR: JSON injection failed!');
  process.exit(1);
}

// Save to both locations
const homeDir = process.env.USERPROFILE || process.env.HOME;
const dir1 = path.join(homeDir, '.wechat-review/reports');
const dir2 = path.resolve(__dirname, '../reports');

fs.mkdirSync(dir1, { recursive: true });
fs.mkdirSync(dir2, { recursive: true });

fs.writeFileSync(path.join(dir1, 'report_final.html'), html, 'utf8');
fs.writeFileSync(path.join(dir2, 'report_final.html'), html, 'utf8');

// Also save report JSON for reference
fs.writeFileSync(path.join(dir1, 'report_final.json'), JSON.stringify(report, null, 2), 'utf8');

console.log('✅ Report generated successfully');
console.log('HTML size:', html.length, 'bytes');
console.log('Sections:', {
  contentFindings: report.sections.content.findings.length,
  growthFindings: report.sections.growth.findings.length,
  distributionFindings: report.sections.distribution.findings.length,
  risks: report.sections.risksAndOpportunities.risks.length,
  crossCheck: report.crossCheck.length,
});
console.log('Saved to:');
console.log(' ', path.join(dir1, 'report_final.html'));
console.log(' ', path.join(dir2, 'report_final.html'));
