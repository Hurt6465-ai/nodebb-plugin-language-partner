'use strict';

const Controllers = {};

Controllers.renderAdminPage = (req, res) => {
  res.render('admin/plugins/language-partner', {
    title: 'Language Partner',
  });
};

module.exports = Controllers;
