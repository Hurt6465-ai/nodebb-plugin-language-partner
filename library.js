'use strict';

const controllers = require('./lib/controllers');
const routeHelpers = require.main.require('./src/routes/helpers');

const plugin = {};

plugin.init = async ({ router }) => {
  routeHelpers.setupPageRoute(router, '/language-partners', [], (req, res) => {
    res.render('language-partners', {
      title: '找语伴',
    });
  });

  routeHelpers.setupAdminPageRoute(
    router,
    '/admin/plugins/language-partner',
    controllers.renderAdminPage
  );
};

plugin.addAdminNavigation = (header) => {
  header.plugins.push({
    route: '/plugins/language-partner',
    icon: 'fa-comments',
    name: '[[language-partners:admin.menu]]',
  });

  return header;
};

module.exports = plugin;
