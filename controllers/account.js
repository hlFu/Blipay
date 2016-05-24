const db = require('../models').db;
const User = require('../models').User;
const Transaction = require('../models').Transaction;
const Router = require('express').Router;
const crypto = require('crypto');
const router = Router();
const Util = require('util');

const cookPassword = (key, salt) => {
  var hash = crypto.createHash('sha512');
  const mid = key.length >> 1
  return hash.update(key.slice(0, mid))
    .update(salt)
    .update(key.slice(mid))
    .digest('base64');
};

const reportError = (path, err) => {
  console.error(
    `\nERROR occurs in ${path}:\n\n${Util.inspect(err)}\n`
  );
};

router.post('/account/register', Promise.coroutine(function* (req, res) {
  console.log('in /account/register', req.body);
  let user = yield User.findOne({
    where: { userName: req.body.userName },
    attributes: ['id']
  })
  if (user) {
    return res.fail({ type: 'USER_EXIST' });
  }
  const salt = crypto.randomBytes(64).toString('base64');
  const newUser = {
    userName: req.body.userName,
    salt: salt,
    loginPass: cookPassword(req.body.loginPass, salt),
    payPass: cookPassword(req.body.payPass, salt)
  };
  user = yield User.create(newUser)
  req.session.userId = user.id
  return res.success({});
}));

router.post('/account/login', Promise.coroutine(function* (req, res) {
  console.log('in /account/login', req.body);
  let user = yield User.findOne({
    where: { userName: req.body.userName },
    attributes: ['id', 'loginPass', 'salt', 'lastLogin']
  });
  if (!user) {
    return res.fail({ type: 'USER_NOT_EXIST' });
  }
  const password = cookPassword(req.body.loginPass,
                                user.salt)
  // 密码错误
  if (password !== user.loginPass)
    return res.fail({ type: 'INVALID_USERNAME_OR_PASSWORD' });
  // 更新最后登录时间
  user.lastLogin = new Date().toString()
  yield user.save()
  // 删除密码字段
  delete user.salt
  delete user.loginPass
  // 登录信息
  req.session.userId = user.id
  return res.success({ user });
}));

router.get('/account/logout', (req, res) => {
  console.log('in logout');
  req.session.userId = null;
  return res.success({});
});

router.get('/account/info', Promise.coroutine(function* (req, res) {
  console.log('in /account/info');
  if (!req.session.userId) {
    return res.success({ })
  }
  const user = yield User.findById(req.session.userId, {
    attributes: ['userName', 'realName', 'balance', 'lastLogin',
                 'email', 'phone', 'idNumber']
  })
  return res.success({ user })
}));

router.get('/account/transactions', Promise.coroutine(function* (req, res) {
  console.log('in /account/transactions');
  if (!req.session.userId) {
    return res.status(403).fail()
  }
  const user = yield User.findById(req.session.userId)
  const transactions = yield user.getTransactions({
    order: ['id']
  });
  return res.success({ transactions })
}));

router.post('/account/check_paypass', Promise.coroutine(function* (req, res) {
  console.log('in check_paypass', req.body);
  if (!req.session.userId) {
    return res.status(403).fail()
  }
  const user = yield User.findById(req.session.userId, {
    attributes: ['salt', 'payPass']
  })
  const payPass = cookPassword(req.body.payPass, user.salt)
  if (payPass === user.payPass) {
    return res.success();
  } else {
    return res.fail({ type: 'WRONG_PAYPASS' });
  }
}));

router.get('/account/check_loginpass', (req, res) => {
  console.log('in check_loginpass');
  console.log(req.query);
  User.findOne({
    where: {
      id: req.query.userId
    }
  }).then((user) => {
    if (!user) {
      console.log('check_loginpass: userId not exists');
      return res.fail({
        code: -1
      });
    }
    if (cookPassword(
          req.query.loginPass,
          user.loginSalt,
          config.loginSaltPos)  === user.loginPass) {
      return res.success({
        code: 0
      });
    } else {
      console.log('check_paypass: loginPass wrong');
      return res.fail({
        code: -3
      });
    }
  }).catch((err) => {
    console.error('check_loginpass: fail\n' + err.message);
    return res.fail({
      code: -2
    });
  });
});

router.get('/account/check_id', Promise.coroutine(function *(req, res) {
  const user = yield User.findOne({
    where: { idNumber: req.query.idNumber }
  });
  if (user) {
    return res.fail({ type: 'ID_EXIST' });
  }
  return res.success();
}));

router.get('/account/check_username', Promise.coroutine(function* (req, res) {
  console.log('in check_username', req.query);
  const user = yield User.findOne({
    where: { userName: req.query.userName }
  })
  if (!user) {
    return res.success();
  } else {
    return res.fail({ type: 'USER_EXIST' });
  }
}));

router.post('/account/update_info', Promise.coroutine(function* (req, res) {
  console.log('in /account/update_info', req.body);
  if (!req.session.userId) {
    return res.status(403).fail()
  }
  const attrs = ['realName', 'idNumber', 'email', 'phone']
  const user = yield User.findById(req.session.userId, {
    // 必须要选出主键，后面才可以保存
    attributes: ['id', ...attrs]
  })
  for (let key in req.body) {
    if (attrs.includes(key)) {
      user[key] = req.body[key]
    }
  }
  yield user.save()
  res.success({ user })
}));

router.post('/account/change_paypass', (req, res) => {
  console.log('in /account/change_paypass');
  console.log(req.body);
  User.findOne({
    where: {
      id: req.body.userId
    }
  })
  .then((user) => {
    if (!user) {
      return res.fail({
        code: -1
      });
    }
    User.update({
      payPass: cookPassword(req.body.payPass,
                            user.paySalt,
                            config.paySaltPos)
    }, {
      where: {
        id: req.body.userId
      }
    })
    .then(() => {
      return res.success({
        code: 0
      });
    });
  })
  .catch((err) => {
    reportError('/account/change_paypass', err);
    return res.fail({
      code: -2
    });
  });
});

router.post('/account/change_loginpass', (req, res) => {
  console.log('in /account/change_loginpass');
  console.log(req.body);
  User.findOne({
    where: {
      id: req.body.userId
    }
  })
  .then((user) => {
    if (!user) {
      return res.fail({
        code: -1
      });
    }
    User.update({
      loginPass: cookPassword(req.body.loginPass,
                              user.loginSalt,
                              config.loginSaltPos)
    }, {
      where: {
        id: req.body.userId
      }
    })
    .then(() => {
      return res.success({
        code: 0
      });
    });
  })
  .catch((err) => {
    reportError('/account/change_loginpass', err);
    return res.fail({
      code: -2
    });
  });
});

// TODO: 支付密码验证
router.post('/account/topup', Promise.coroutine(function* (req, res) {
  if (!req.session.userId) {
    return res.status(403).fail()
  }
  const delta = parseFloat(req.body.amount)
  if (isNaN(delta)) {
    return res.status(400).fail()
  }
  yield User.update({
    balance: db.literal(`balance + ${delta}`)
  }, {
    where: { id: req.session.userId }
  });
  const transaction = yield Transaction.create({
    userId: req.session.userId,
    amount: delta,
    type: 1,
    status: 1,
    info: `充值 ${delta} 元`
  });
  const user = yield User.findById(req.session.userId, {
    attributes: ['balance']
  })
  return res.success({ user, transaction });
}));

// TODO: 支付密码验证
router.post('/account/withdraw', Promise.coroutine(function* (req, res) {
  if (!req.session.userId) {
    return res.status(403).fail()
  }
  const delta = parseFloat(req.body.amount)
  if (isNaN(delta)) {
    return res.status(400).fail()
  }
  let user = yield User.findById(req.session.userId,{
    attributes: ['balance']
  });
  if (user.balance < delta) {
    return res.fail({ type: 'INSUFFICIENT_BALANCE' });
  }
  yield User.update({
    balance: db.literal(`balance - ${delta}`)
  }, {
    where: { id: req.session.userId }
  });
  console.log(req.session.userId)
  const transaction = yield Transaction.create({
    userId: req.session.userId,
    amount: -delta,
    type: 2,
    status: 1,
    info: `提现 ${delta} 元`
  });
  user = yield User.findById(req.session.userId, {
    attributes: ['balance']
  })
  return res.success({ user, transaction });
}));

module.exports = router;
