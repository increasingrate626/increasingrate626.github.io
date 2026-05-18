hexo.extend.filter.register('after_render:html', function (html) {
  return html.replace(
    /<a href="(#[^"]+)" class="headerlink" title="[^"]*"><\/a>/g,
    '<a href="$1" class="headerlink" aria-hidden="true"></a>'
  );
});
