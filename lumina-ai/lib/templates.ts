export interface Template {
  id: string;
  category: string;
  categoryLabel: string;
  title: string;
  prompt: string;
  storagePath: string;
}

export const templateCategories = [
  { key: "all", label: "全部" },
  { key: "ecommerce", label: "电商类" },
  { key: "restaurant", label: "餐饮零售" },
  { key: "brand", label: "品牌营销" },
  { key: "festival", label: "节日活动" },
  { key: "corporate", label: "企业宣传" },
];

export const templates: Template[] = [
  { id: "ecommerce-minimal-product", category: "ecommerce", categoryLabel: "电商类", title: "产品主图 - 极简白底", prompt: "现代简约风格，白色背景，一款高端产品放在大理石台面上，柔和自然光，极简构图，中文文案优雅排版", storagePath: "templates/ecommerce-minimal-product.png" },
  { id: "ecommerce-douyin-viral", category: "ecommerce", categoryLabel: "电商类", title: "抖音爆款风", prompt: "抖音爆款风格，年轻女性手持产品，粉色渐变背景，活力时尚，文字'夏日限定 0糖'醒目", storagePath: "templates/ecommerce-douyin-viral.png" },
  { id: "ecommerce-black-gold", category: "ecommerce", categoryLabel: "电商类", title: "黑金质感", prompt: "产品主图，黑色背景，金色高光，专业摄影棚光效，文字'极致手感'", storagePath: "templates/ecommerce-black-gold.png" },
  { id: "ecommerce-lifestyle-scene", category: "ecommerce", categoryLabel: "电商类", title: "场景化展示", prompt: "高端家居场景，产品融入现代客厅环境，自然光线，空间感十足，温暖舒适", storagePath: "templates/ecommerce-lifestyle-scene.png" },
  { id: "ecommerce-floating-creative", category: "ecommerce", categoryLabel: "电商类", title: "悬浮创意", prompt: "产品悬浮于纯色背景中，晶莹剔透，角度45度，3D渲染质感，文字'全新上市'", storagePath: "templates/ecommerce-floating-creative.png" },
  { id: "ecommerce-model-scene", category: "ecommerce", categoryLabel: "电商类", title: "模特场景", prompt: "时尚模特手持产品，户外自然光，浅景深虚化背景，杂志封面质感，文字'明星同款'", storagePath: "templates/ecommerce-model-scene.png" },
  { id: "ecommerce-multi-color", category: "ecommerce", categoryLabel: "电商类", title: "多色展示", prompt: "产品多色并列展示，白色背景，俯拍视角，整齐排列，色彩鲜明，电商产品图标准", storagePath: "templates/ecommerce-multi-color.png" },
  { id: "ecommerce-detail-closeup", category: "ecommerce", categoryLabel: "电商类", title: "特写细节", prompt: "产品细节特写，微距拍摄质感，浅景深，突出材质和工艺，高端感十足", storagePath: "templates/ecommerce-detail-closeup.png" },
  { id: "ecommerce-gift-box", category: "ecommerce", categoryLabel: "电商类", title: "礼盒套装", prompt: "精致礼盒包装展示，丝带蝴蝶结，温暖灯光，送礼场景，文字'心意之选'", storagePath: "templates/ecommerce-gift-box.png" },
  { id: "ecommerce-social-review", category: "ecommerce", categoryLabel: "电商类", title: "种草测评", prompt: "小红书种草风格，产品手拿展示，柔光滤镜，文字'好用哭了'手写体", storagePath: "templates/ecommerce-social-review.png" },
  { id: "ecommerce-flash-sale", category: "ecommerce", categoryLabel: "电商类", title: "限时秒杀", prompt: "电商秒杀海报，倒计时元素，红色基调，紧迫感设计，文字'限时抢购 只要99'", storagePath: "templates/ecommerce-flash-sale.png" },
  { id: "ecommerce-cross-border", category: "ecommerce", categoryLabel: "电商类", title: "跨境精品", prompt: "国际化风格，产品在简约场景中，英文和中文双语文案，全球购质感", storagePath: "templates/ecommerce-cross-border.png" },
  { id: "ecommerce-new-launch", category: "ecommerce", categoryLabel: "电商类", title: "新品首发", prompt: "新品发布海报，科技感蓝光，产品45度展示，现代简约，文字'新品首发 抢先体验'", storagePath: "templates/ecommerce-new-launch.png" },
  { id: "ecommerce-user-testimonial", category: "ecommerce", categoryLabel: "电商类", title: "用户评价", prompt: "产品使用场景，真实用户场景再现，温馨自然，五星好评展示，亲和力满分", storagePath: "templates/ecommerce-user-testimonial.png" },
  { id: "ecommerce-product-set", category: "ecommerce", categoryLabel: "电商类", title: "套装组合", prompt: "系列产品组合展示，配色协调，平面设计风格，产品矩阵排列，专业感", storagePath: "templates/ecommerce-product-set.png" },

  { id: "restaurant-chinese", category: "restaurant", categoryLabel: "餐饮零售", title: "中式餐厅", prompt: "温馨中式餐厅内景，一桌精致粤菜，暖黄灯光，中文菜单'招牌烤乳猪'", storagePath: "templates/restaurant-chinese.png" },
  { id: "restaurant-opening", category: "restaurant", categoryLabel: "餐饮零售", title: "新店开业", prompt: "新店开业海报，红色中国风背景，烟花绽放，文字'开业大吉 满减 50%'", storagePath: "templates/restaurant-opening.png" },
  { id: "restaurant-coffee", category: "restaurant", categoryLabel: "餐饮零售", title: "咖啡特调", prompt: "咖啡店外摆场景，阳光洒落，年轻人喝拿铁，文字'今日特调'", storagePath: "templates/restaurant-coffee.png" },
  { id: "restaurant-dessert", category: "restaurant", categoryLabel: "餐饮零售", title: "甜品诱惑", prompt: "精致甜品特写，柔光拍摄，奶油质感，粉色背景，文字'甜蜜治愈'，ins风格", storagePath: "templates/restaurant-dessert.png" },
  { id: "restaurant-hotpot", category: "restaurant", categoryLabel: "餐饮零售", title: "火锅盛宴", prompt: "火锅沸腾场景，丰富食材围绕，热腾腾蒸汽，暖色调，食欲感满分，文字'麻辣鲜香'", storagePath: "templates/restaurant-hotpot.png" },
  { id: "restaurant-japanese", category: "restaurant", categoryLabel: "餐饮零售", title: "日料精致", prompt: "日式料理摆盘，木质托盘，简约背景，冷色调，禅意风格，文字'匠心日料'", storagePath: "templates/restaurant-japanese.png" },
  { id: "restaurant-drink", category: "restaurant", categoryLabel: "餐饮零售", title: "饮品海报", prompt: "夏日饮品海报，冰块凝结水珠，新鲜水果装饰，明亮色调，文字'冰爽一夏'", storagePath: "templates/restaurant-drink.png" },
  { id: "restaurant-bakery", category: "restaurant", categoryLabel: "餐饮零售", title: "烘焙面包", prompt: "现烤面包出炉，金黄色泽，面粉飘散，木质背景，暖光，文字'新鲜出炉'", storagePath: "templates/restaurant-bakery.png" },
  { id: "restaurant-seafood", category: "restaurant", categoryLabel: "餐饮零售", title: "海鲜大餐", prompt: "豪华海鲜拼盘，龙虾帝王蟹，冰块铺垫，奢华场景，文字'海味盛宴'", storagePath: "templates/restaurant-seafood.png" },
  { id: "restaurant-salad", category: "restaurant", categoryLabel: "餐饮零售", title: "素食轻食", prompt: "清新素食沙拉，自然光俯拍，绿色基调，健康轻食概念，文字'轻食主义'", storagePath: "templates/restaurant-salad.png" },
  { id: "restaurant-night-delivery", category: "restaurant", categoryLabel: "餐饮零售", title: "夜宵外卖", prompt: "夜宵外卖海报，深夜街景，热气美食，霓虹灯氛围，文字'深夜食堂'", storagePath: "templates/restaurant-night-delivery.png" },
  { id: "restaurant-milk-tea", category: "restaurant", categoryLabel: "餐饮零售", title: "奶茶新品", prompt: "网红奶茶新品，渐变分层效果，芝士奶盖特写，少女感配色，文字'新品首发'", storagePath: "templates/restaurant-milk-tea.png" },

  { id: "brand-refresh", category: "brand", categoryLabel: "品牌营销", title: "品牌焕新", prompt: "高级黑金风格，企业 Logo 置中，深色背景，粒子光效，文字'2026 品牌焕新'", storagePath: "templates/brand-refresh.png" },
  { id: "brand-xiaohongshu-cover", category: "brand", categoryLabel: "品牌营销", title: "小红书封面", prompt: "小红书笔记封面，奶油色调，产品平铺 + 手写笔记，极简高级感", storagePath: "templates/brand-xiaohongshu-cover.png" },
  { id: "brand-nine-grid", category: "brand", categoryLabel: "品牌营销", title: "朋友圈九宫格", prompt: "朋友圈九宫格模板，统一色调，现代极简，品牌主色贯穿", storagePath: "templates/brand-nine-grid.png" },
  { id: "brand-corporate-image", category: "brand", categoryLabel: "品牌营销", title: "企业形象", prompt: "企业文化海报，团队合影风格，现代办公室，文字'我们是光'", storagePath: "templates/brand-corporate-image.png" },
  { id: "brand-tech-poster", category: "brand", categoryLabel: "品牌营销", title: "科技感海报", prompt: "科技蓝渐变背景，数据流线条，未来感十足，品牌Logo居中，文字'智领未来'", storagePath: "templates/brand-tech-poster.png" },
  { id: "brand-minimal", category: "brand", categoryLabel: "品牌营销", title: "极简品牌", prompt: "纯白背景，产品居中，极简线条装饰，高级时装感，文字最小化，留白美学", storagePath: "templates/brand-minimal.png" },
  { id: "brand-social-media", category: "brand", categoryLabel: "品牌营销", title: "社交媒体", prompt: "Instagram 风格，产品场景化拍摄，暖色调滤镜，方形构图，生活方式展现", storagePath: "templates/brand-social-media.png" },
  { id: "brand-vip-day", category: "brand", categoryLabel: "品牌营销", title: "会员日", prompt: "会员专属海报，金色元素，高端质感，VIP标识，文字'会员尊享 限时特惠'", storagePath: "templates/brand-vip-day.png" },
  { id: "brand-story", category: "brand", categoryLabel: "品牌营销", title: "品牌故事", prompt: "品牌起源故事画面，手绘插画风，暖色调，时间线叙事，文字'始于初心'", storagePath: "templates/brand-story.png" },
  { id: "brand-invitation", category: "brand", categoryLabel: "品牌营销", title: "活动邀请函", prompt: "精致邀请函设计，烫金工艺效果，深色背景，正式感，文字'诚邀莅临'", storagePath: "templates/brand-invitation.png" },

  { id: "festival-spring", category: "festival", categoryLabel: "节日活动", title: "春节主题", prompt: "春节主题，红色灯笼 + 金色文字'新春快乐'，产品融入画面", storagePath: "templates/festival-spring.png" },
  { id: "festival-double-11", category: "festival", categoryLabel: "节日活动", title: "双11大促", prompt: "双11 大促，赛博霓虹风格，中文'全场 5 折'", storagePath: "templates/festival-double-11.png" },
  { id: "festival-mid-autumn", category: "festival", categoryLabel: "节日活动", title: "中秋佳节", prompt: "中秋节主题，圆月当空，桂花玉兔，暖金色调，文字'月圆人圆'，礼盒融入", storagePath: "templates/festival-mid-autumn.png" },
  { id: "festival-qixi", category: "festival", categoryLabel: "节日活动", title: "七夕情人节", prompt: "浪漫七夕，粉紫渐变，心形元素，玫瑰花瓣飘落，文字'以爱之名'", storagePath: "templates/festival-qixi.png" },
  { id: "festival-mothers-day", category: "festival", categoryLabel: "节日活动", title: "母亲节", prompt: "温馨母亲节海报，康乃馨花束，暖粉色调，感人文案，文字'谢谢妈妈'", storagePath: "templates/festival-mothers-day.png" },
  { id: "festival-christmas", category: "festival", categoryLabel: "节日活动", title: "圣诞元旦", prompt: "圣诞新年主题，白色雪景圣诞树，金色装饰，雪花飘落，文字'Merry Christmas'", storagePath: "templates/festival-christmas.png" },
  { id: "festival-618", category: "festival", categoryLabel: "节日活动", title: "618年中促", prompt: "618年中大促，3D数字618，炫彩背景，促销元素铺满，文字'年中狂欢 满300减50'", storagePath: "templates/festival-618.png" },
  { id: "festival-national-day", category: "festival", categoryLabel: "节日活动", title: "国庆黄金周", prompt: "国庆主题，中国红主色调，天安门剪影，金色文字'欢度国庆 全场8折'", storagePath: "templates/festival-national-day.png" },

  { id: "corporate-culture", category: "corporate", categoryLabel: "企业宣传", title: "企业文化", prompt: "企业文化海报，团队合影风格，现代办公室，文字'我们是光'", storagePath: "templates/corporate-culture.png" },
  { id: "corporate-recruitment", category: "corporate", categoryLabel: "企业宣传", title: "招聘海报", prompt: "现代化招聘海报，团队工作场景，活力橙色点缀，文字'加入我们 共创未来'", storagePath: "templates/corporate-recruitment.png" },
  { id: "corporate-launch", category: "corporate", categoryLabel: "企业宣传", title: "产品发布会", prompt: "产品发布会预告，大屏舞台效果，聚光灯，科技感，文字'新品发布会 敬请期待'", storagePath: "templates/corporate-launch.png" },
  { id: "corporate-annual-meeting", category: "corporate", categoryLabel: "企业宣传", title: "年会海报", prompt: "企业年会海报，颁奖典礼风格，金色红色搭配，庄重喜庆，文字'年度盛典'", storagePath: "templates/corporate-annual-meeting.png" },
  { id: "corporate-testimonial", category: "corporate", categoryLabel: "企业宣传", title: "客户见证", prompt: "客户好评展示，真实商务场景，商务人士握手，可信赖感，文字'客户信赖之选'", storagePath: "templates/corporate-testimonial.png" },
];

export function getTemplateImageUrl(storagePath: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bucket = process.env.NEXT_PUBLIC_TEMPLATE_BUCKET || "lumina-templates";
  if (!supabaseUrl) return "";
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${storagePath}`;
}
