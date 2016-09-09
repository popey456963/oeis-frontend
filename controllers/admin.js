var adminNames = ['read', 'write', 'execute']
exports.ensureAdmin = []

for (var i = 0; i < adminNames.length; i++) {
  exports.ensureAdmin[adminNames[i]] = new Function('req', 'res', 'next', `
    if (req.isAuthenticated()) {
      var pad = new Array(names.length + 1).join("0");
      if (String(pad + (req.user.admin >>> 0).toString(2).slice(names.length * -1).charAt(` + i + `) == "1")) {
        next()
      } else {
        res.render('./admin/not_admin', {
          title: "Not An Admin :: OEIS Lookup"
        })
      }
    } else {
      res.redirect('/login')
    }
  `)
}