// 自定义侧边栏配置
hexo.extend.filter.register('before_generate', function() {
  var themeConfig = this.theme.config || this.theme;

  // 移除归档小部件
  if (themeConfig.widgets && Array.isArray(themeConfig.widgets)) {
    themeConfig.widgets = themeConfig.widgets.filter(function(w) {
      return w !== 'archive';
    });
  }
  // 设置文章显示数量为极大值，效果等同显示全部
  themeConfig.recent_posts_limits = 9999;
});
