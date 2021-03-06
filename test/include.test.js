/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , Sequelize = require('../index')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + "/../lib/data-types")
  , datetime  = require('chai-datetime')
  , async     = require('async')
  , _         = require('lodash')

chai.use(datetime)
chai.Assertion.includeStack = true

var sortById = function(a, b) {
  return a.id < b.id ? -1 : 1
}

describe(Support.getTestDialectTeaser("Include"), function () {
  describe('find', function () {
    it('should support a empty belongsTo include', function (done) {
      var Company = this.sequelize.define('Company', {})
        , User = this.sequelize.define('User', {})

      User.belongsTo(Company, {as: 'Employer'})
      this.sequelize.sync({force: true}).done(function () {
        User.create().then(function () {
          User.find({
            include: [{model: Company, as: 'Employer'}]
          }).done(function (err, user) {
            expect(err).not.to.be.ok
            expect(user).to.be.ok
            done()
          })
        }, done)
      })
    })

    it('should support a empty hasOne include', function (done) {
      var Company = this.sequelize.define('Company', {})
        , Person = this.sequelize.define('Person', {})

      Company.hasOne(Person, {as: 'CEO'})
      this.sequelize.sync({force: true}).done(function () {
        Company.create().then(function () {
          Company.find({
            include: [{model: Person, as: 'CEO'}]
          }).done(function (err, company) {
            expect(err).not.to.be.ok
            expect(company).to.be.ok
            done()
          })
        }, done)
      })
    })

    it('should support a simple nested belongsTo -> belongsTo include', function (done) {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {})

      Task.belongsTo(User)
      User.belongsTo(Group)

      this.sequelize.sync({force: true}).done(function () {
        async.auto({
          task: function (callback) {
            Task.create().done(callback)
          },
          user: function (callback) {
            User.create().done(callback)
          },
          group: function (callback) {
            Group.create().done(callback)
          },
          taskUser: ['task', 'user', function (callback, results) {
            results.task.setUser(results.user).done(callback)
          }],
          userGroup: ['user', 'group', function (callback, results) {
            results.user.setGroup(results.group).done(callback)
          }]
        }, function (err, results) {
          expect(err).not.to.be.ok

          Task.find({
            where: {
              id: results.task.id
            },
            include: [
              {model: User, include: [
                {model: Group}
              ]}
            ]
          }).done(function (err, task) {
            expect(err).not.to.be.ok
            expect(task.user).to.be.ok
            expect(task.user.group).to.be.ok
            done()
          })
        })
      })
    })

    it('should support a simple nested hasOne -> hasOne include', function (done) {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {})

      User.hasOne(Task)
      Group.hasOne(User)

      this.sequelize.sync({force: true}).done(function () {
        async.auto({
          task: function (callback) {
            Task.create().done(callback)
          },
          user: function (callback) {
            User.create().done(callback)
          },
          group: function (callback) {
            Group.create().done(callback)
          },
          userTask: ['user', 'task', function (callback, results) {
            results.user.setTask(results.task).done(callback)
          }],
          groupUser: ['group', 'user', function (callback, results) {
            results.group.setUser(results.user).done(callback)
          }]
        }, function (err, results) {
          expect(err).not.to.be.ok

          Group.find({
            where: {
              id: results.group.id
            },
            include: [
              {model: User, include: [
                {model: Task}
              ]}
            ]
          }).done(function (err, group) {
            expect(err).not.to.be.ok
            expect(group.user).to.be.ok
            expect(group.user.task).to.be.ok
            done()
          })
        })
      })
    })

    it('should support a simple nested hasMany -> belongsTo include', function (done) {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Project = this.sequelize.define('Project', {})

      User.hasMany(Task)
      Task.belongsTo(Project)

      this.sequelize.sync({force: true}).done(function () {
        async.auto({
          user: function (callback) {
            User.create().done(callback)
          },
          projects: function (callback) {
            Project.bulkCreate([{}, {}]).done(function () {
              Project.findAll().done(callback)
            })
          },
          tasks: ['projects', function(callback, results) {
            Task.bulkCreate([
              {ProjectId: results.projects[0].id},
              {ProjectId: results.projects[1].id},
              {ProjectId: results.projects[0].id},
              {ProjectId: results.projects[1].id}
            ]).done(function () {
              Task.findAll().done(callback)
            })
          }],
          userTasks: ['user', 'tasks', function (callback, results) {
            results.user.setTasks(results.tasks).done(callback)
          }]
        }, function (err, results) {
          User.find({
            where: {
              id: results.user.id
            },
            include: [
              {model: Task, include: [
                {model: Project}
              ]}
            ]
          }).done(function (err, user) {
            expect(err).not.to.be.ok
            expect(user.tasks).to.be.ok
            expect(user.tasks.length).to.equal(4)

            user.tasks.forEach(function (task) {
              expect(task.project).to.be.ok
            })

            done()
          })
        })
      })
    })

    it('should support a simple nested belongsTo -> hasMany include', function (done) {
      var Task = this.sequelize.define('Task', {})
        , Worker = this.sequelize.define('Worker', {})
        , Project = this.sequelize.define('Project', {})

      Worker.belongsTo(Project)
      Project.hasMany(Task)

      this.sequelize.sync({force: true}).done(function () {
        async.auto({
          worker: function (callback) {
            Worker.create().done(callback)
          },
          project: function (callback) {
            Project.create().done(callback)
          },
          tasks: function(callback) {
            Task.bulkCreate([
              {},
              {},
              {},
              {}
            ]).done(function () {
              Task.findAll().done(callback)
            })
          },
          projectTasks: ['project', 'tasks', function (callback, results) {
            results.project.setTasks(results.tasks).done(callback)
          }],
          projectWorker: ['project', 'worker', function (callback, results) {
            results.worker.setProject(results.project).done(callback)
          }]
        }, function (err, results) {
          Worker.find({
            where: {
              id: results.worker.id
            },
            include: [
              {model: Project, include: [
                {model: Task}
              ]}
            ]
          }).done(function (err, worker) {
            expect(err).not.to.be.ok
            expect(worker.project).to.be.ok
            expect(worker.project.tasks).to.be.ok
            expect(worker.project.tasks.length).to.equal(4)

            done()
          })
        })
      })
    })

    it('should support a simple nested hasMany <-> hasMany include', function (done) {
      var User = this.sequelize.define('User', {})
        , Product = this.sequelize.define('Product', {
            title: DataTypes.STRING
          })
        , Tag = this.sequelize.define('Tag', {
            name: DataTypes.STRING
          })

      User.hasMany(Product)
      Product.hasMany(Tag)
      Tag.hasMany(Product)

      this.sequelize.sync({force: true}).done(function () {
        async.auto({
          user: function (callback) {
            User.create().done(callback)
          },
          products: function (callback) {
            Product.bulkCreate([
              {title: 'Chair'},
              {title: 'Desk'},
              {title: 'Dress'},
              {title: 'Bed'}
            ]).done(function () {
              Product.findAll({order: [ ['id'] ]}).done(callback)
            })
          },
          tags: function(callback) {
            Tag.bulkCreate([
              {name: 'A'},
              {name: 'B'},
              {name: 'C'}
            ]).done(function () {
              Tag.findAll({order: [ ['id'] ]}).done(callback)
            })
          },
          userProducts: ['user', 'products', function (callback, results) {
            results.user.setProducts(results.products).done(callback)
          }],
          productTags: ['products', 'tags', function (callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer()

            chainer.add(results.products[0].setTags([results.tags[0], results.tags[2]]))
            chainer.add(results.products[1].setTags([results.tags[1]]))
            chainer.add(results.products[2].setTags([results.tags[0], results.tags[1], results.tags[2]]))

            chainer.run().done(callback)
          }]
        }, function (err, results) {
          expect(err).not.to.be.ok

          User.find({
            where: {
              id: results.user.id
            },
            include: [
              {model: Product, include: [
                {model: Tag}
              ]}
            ],
            order: [ ['id'], [Product, 'id'] ]
          }).done(function (err, user) {
            expect(err).not.to.be.ok

            expect(user.products.length).to.equal(4)
            expect(user.products[0].tags.length).to.equal(2)
            expect(user.products[1].tags.length).to.equal(1)
            expect(user.products[2].tags.length).to.equal(3)
            expect(user.products[3].tags.length).to.equal(0)
            done()
          })
        })
      })
    })

    it('should support an include with multiple different association types', function (done) {
      var User = this.sequelize.define('User', {})
        , Product = this.sequelize.define('Product', {
            title: DataTypes.STRING
          })
        , Tag = this.sequelize.define('Tag', {
            name: DataTypes.STRING
          })
        , Price = this.sequelize.define('Price', {
            value: DataTypes.FLOAT
          })
        , Customer = this.sequelize.define('Customer', {
            name: DataTypes.STRING
        })
        , Group = this.sequelize.define('Group', {
            name: DataTypes.STRING
          })
        , GroupMember = this.sequelize.define('GroupMember', {

          })
        , Rank = this.sequelize.define('Rank', {
            name: DataTypes.STRING,
            canInvite: {
              type: DataTypes.INTEGER,
              defaultValue: 0
            },
            canRemove: {
              type: DataTypes.INTEGER,
              defaultValue: 0
            }
          })

      User.hasMany(Product)
      Product.belongsTo(User)

      Product.hasMany(Tag)
      Tag.hasMany(Product)
      Product.belongsTo(Tag, {as: 'Category'})

      Product.hasMany(Price)
      Price.belongsTo(Product)

      User.hasMany(GroupMember, {as: 'Memberships'})
      GroupMember.belongsTo(User)
      GroupMember.belongsTo(Rank)
      GroupMember.belongsTo(Group)
      Group.hasMany(GroupMember, {as: 'Memberships'})

      this.sequelize.sync({force: true}).done(function () {
        async.auto({
          user: function (callback) {
            User.create().done(callback)
          },
          groups: function(callback) {
            Group.bulkCreate([
              {name: 'Developers'},
              {name: 'Designers'}
            ]).done(function () {
              Group.findAll().done(callback)
            })
          },
          ranks: function(callback) {
            Rank.bulkCreate([
              {name: 'Admin', canInvite: 1, canRemove: 1},
              {name: 'Member', canInvite: 1, canRemove: 0}
            ]).done(function () {
              Rank.findAll().done(callback)
            })
          },
          memberships: ['user', 'groups', 'ranks', function (callback, results) {
            GroupMember.bulkCreate([
              {UserId: results.user.id, GroupId: results.groups[0].id, RankId: results.ranks[0].id},
              {UserId: results.user.id, GroupId: results.groups[1].id, RankId: results.ranks[1].id}
            ]).done(callback)
          }],
          products: function (callback) {
            Product.bulkCreate([
              {title: 'Chair'},
              {title: 'Desk'}
            ]).done(function () {
              Product.findAll().done(callback)
            })
          },
          tags: function(callback) {
            Tag.bulkCreate([
              {name: 'A'},
              {name: 'B'},
              {name: 'C'}
            ]).done(function () {
              Tag.findAll().done(callback)
            })
          },
          userProducts: ['user', 'products', function (callback, results) {
            results.user.setProducts(results.products).done(callback)
          }],
          productTags: ['products', 'tags', function (callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer()

            chainer.add(results.products[0].setTags([results.tags[0], results.tags[2]]))
            chainer.add(results.products[1].setTags([results.tags[1]]))
            chainer.add(results.products[0].setCategory(results.tags[1]))

            chainer.run().done(callback)
          }],
          prices: ['products', function (callback, results) {
            Price.bulkCreate([
              {ProductId: results.products[0].id, value: 5},
              {ProductId: results.products[0].id, value: 10},
              {ProductId: results.products[1].id, value: 5},
              {ProductId: results.products[1].id, value: 10},
              {ProductId: results.products[1].id, value: 15},
              {ProductId: results.products[1].id, value: 20}
            ]).done(callback)
          }]
        }, function (err, results) {
          expect(err).not.to.be.ok

          User.find({
            where: {id: results.user.id},
            include: [
              {model: GroupMember, as: 'Memberships', include: [
                Group,
                Rank
              ]},
              {model: Product, include: [
                Tag,
                {model: Tag, as: 'Category'},
                Price
              ]}
            ]
          }).done(function (err, user) {
            user.memberships.sort(sortById)
            expect(user.memberships.length).to.equal(2)
            expect(user.memberships[0].group.name).to.equal('Developers')
            expect(user.memberships[0].rank.canRemove).to.equal(1)
            expect(user.memberships[1].group.name).to.equal('Designers')
            expect(user.memberships[1].rank.canRemove).to.equal(0)

            user.products.sort(sortById)
            expect(user.products.length).to.equal(2)
            expect(user.products[0].tags.length).to.equal(2)
            expect(user.products[1].tags.length).to.equal(1)
            expect(user.products[0].category).to.be.ok
            expect(user.products[1].category).not.to.be.ok

            expect(user.products[0].prices.length).to.equal(2)
            expect(user.products[1].prices.length).to.equal(4)

            done()
          })
        })
      })
    })

    it('should support specifying attributes', function (done) {
      var Project = this.sequelize.define('Project', {
        title: Sequelize.STRING
      })

      var Task = this.sequelize.define('Task', {
        title: Sequelize.STRING,
        description: Sequelize.TEXT
      })

      Project.hasMany(Task)
      Task.belongsTo(Project)

      this.sequelize.sync({force: true}).done(function() {
        Project.create({
          title: 'BarFoo'
        }).done(function (err, project) {
          Task.create({title: 'FooBar'}).done(function (err, task) {
            task.setProject(project).done(function () {
              Task.findAll({
                attributes: ['title'],
                include: [
                  {model: Project, attributes: ['title']}
                ]
              }).done(function(err, tasks) {
                expect(err).not.to.be.ok
                expect(tasks[0].title).to.equal('FooBar')
                expect(tasks[0].project.title).to.equal('BarFoo');

                expect(_.omit(tasks[0].get(), 'project')).to.deep.equal({ title: 'FooBar' })
                expect(tasks[0].project.get()).to.deep.equal({ title: 'BarFoo'})

                done()
              })
            })
          })
        })
      })
    })

    it('should support self associated hasMany (with through) include', function (done) {
      var Group = this.sequelize.define('Group', {
        name: DataTypes.STRING
      })

      Group.hasMany(Group, { through: 'groups_outsourcing_companies', as: 'OutsourcingCompanies'});

      this.sequelize.sync({force: true}).done(function (err) {
        Group.bulkCreate([
          {name: 'SoccerMoms'},
          {name: 'Coca Cola'},
          {name: 'Dell'},
          {name: 'Pepsi'}
        ]).done(function () {
          Group.findAll().done(function (err, groups) {
            groups[0].setOutsourcingCompanies(groups.slice(1)).done(function (err) {
              expect(err).not.to.be.ok

              Group.find({
                where: {
                  id: groups[0].id,
                },
                include: [{model: Group, as: 'OutsourcingCompanies'}]
              }).done(function (err, group) {
                expect(err).not.to.be.ok
                expect(group.outsourcingCompanies.length).to.equal(3)
                done()
              })
            })
          })
        })
      })
    })

    it('should support including date fields, with the correct timeszone', function (done) {
      var User = this.sequelize.define('user', {
          dateField: Sequelize.DATE
        }, {timestamps: false})
        , Group = this.sequelize.define('group', {
          dateField: Sequelize.DATE
        }, {timestamps: false})

      User.hasMany(Group)
      Group.hasMany(User)

      this.sequelize.sync().success(function () {
        User.create({ dateField: Date.UTC(2014, 1, 20) }).success(function (user) {
          Group.create({ dateField: Date.UTC(2014, 1, 20) }).success(function (group) {
            user.addGroup(group).success(function () {
              User.find({
                where: {
                  id: user.id
                }, 
                include: [Group]
              }).success(function (user) {
                expect(user.dateField.getTime()).to.equal(Date.UTC(2014, 1, 20))
                expect(user.groups[0].dateField.getTime()).to.equal(Date.UTC(2014, 1, 20))
                
                done()
              })
            })
          })
        })
      })
    })
  })

  describe('where', function () {
    it('should support Sequelize.and()', function (done) {
      var User = this.sequelize.define('User', {})
        , Item = this.sequelize.define('Item', {'test': DataTypes.STRING})

      User.hasOne(Item);
      Item.belongsTo(User);

      this.sequelize.sync().done(function() {
        async.auto({
          users: function(callback) {
            User.bulkCreate([{}, {}, {}]).done(function() {
              User.findAll().done(callback)
            })
          },
          items: function(callback) {
            Item.bulkCreate([
              {'test': 'abc'},
              {'test': 'def'},
              {'test': 'ghi'}
            ]).done(function() {
              Item.findAll().done(callback)
            })
          },
          associate: ['users', 'items', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer()

            var users = results.users
            var items = results.items

            chainer.add(users[0].setItem(items[0]))
            chainer.add(users[1].setItem(items[1]))
            chainer.add(users[2].setItem(items[2]))

            chainer.run().done(callback)
          }]
        }, function() {
          User.findAll({include: [
            {model: Item, where: Sequelize.and({
              test: 'def'
            })}
          ]}).done(function(err, result) {
            expect(err).not.to.be.ok

            expect(result.length).to.eql(1)
            expect(result[0].item.test).to.eql('def')
            done()
          })
        })
      }) 
    })

    it('should support Sequelize.or()', function (done) {
      var User = this.sequelize.define('User', {})
        , Item = this.sequelize.define('Item', {'test': DataTypes.STRING})

      User.hasOne(Item);
      Item.belongsTo(User);

      this.sequelize.sync().done(function() {
        async.auto({
          users: function(callback) {
            User.bulkCreate([{}, {}, {}]).done(function() {
              User.findAll().done(callback)
            })
          },
          items: function(callback) {
            Item.bulkCreate([
              {'test': 'abc'},
              {'test': 'def'},
              {'test': 'ghi'}
            ]).done(function() {
              Item.findAll().done(callback)
            })
          },
          associate: ['users', 'items', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer()

            var users = results.users
            var items = results.items

            chainer.add(users[0].setItem(items[0]))
            chainer.add(users[1].setItem(items[1]))
            chainer.add(users[2].setItem(items[2]))

            chainer.run().done(callback)
          }]
        }, function() {
          User.findAll({include: [
            {model: Item, where: Sequelize.or({
              test: 'def'
            }, {
              test: 'abc'
            })}
          ]}).done(function(err, result) {
            expect(err).not.to.be.ok
            expect(result.length).to.eql(2)
            done()
          })
        })
      }) 
    })
  })

  describe('findAndCountAll', function () {
    it('should include associations to findAndCountAll', function(done) {
      var User = this.sequelize.define('User', {})
        , Item = this.sequelize.define('Item', {'test': DataTypes.STRING})

      User.hasOne(Item);
      Item.belongsTo(User);

      this.sequelize.sync().done(function() {
        async.auto({
          users: function(callback) {
            User.bulkCreate([{}, {}, {}]).done(function() {
              User.findAll().done(callback)
            })
          },
          items: function(callback) {
            Item.bulkCreate([
              {'test': 'abc'},
              {'test': 'def'},
              {'test': 'ghi'}
            ]).done(function() {
              Item.findAll().done(callback)
            })
          },
          associate: ['users', 'items', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer()

            var users = results.users
            var items = results.items

            chainer.add(users[0].setItem(items[0]))
            chainer.add(users[1].setItem(items[1]))
            chainer.add(users[2].setItem(items[2]))

            chainer.run().done(callback)
          }]
        }, function() {
          User.findAndCountAll({include: [
            {model: Item, where: {
              test: 'def'
            }}
          ]}).done(function(err, result) {
            expect(err).not.to.be.ok
            expect(result.count).to.eql(1)

            expect(result.rows.length).to.eql(1)
            expect(result.rows[0].item.test).to.eql('def')
            done()
          })
        })
      }) 
    })
  })
})