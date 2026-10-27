const assert = require('assert')
const createPlugin = require('../index')

function fixture (presets, options = {}) {
  const puts = {}
  const messages = []
  let subscriptions = 0
  const app = {
    debug: () => {}, error: () => {},
    registerPutHandler: (_context, path, handler) => { puts[path] = handler },
    handleMessage: (_id, delta) => { messages.push(delta) },
    subscriptionmanager: { subscribe: () => { subscriptions++ } }
  }
  const plugin = createPlugin(app)
  plugin.start(Object.assign({ presets }, options))
  return { puts, messages, subscriptions, plugin }
}

function values (messages) {
  return messages.flatMap(delta => (delta.updates || []).flatMap(update => update.values || []))
}

function vendorValues (messages) {
  return values(messages).filter(v => /^electrical\.displays\.(navico|raymarine)\./.test(v.path))
}

describe('explicit presets', function () {
  const presets = {
    enabled: true,
    profiles: [{ name: 'night',
      navico: [{ group: 'default', brightness: 66, palette: 'night' }],
      raymarine: [
        { group: 'helm1', brightness: 40, color: 'red/black' },
        { group: 'cockpit', brightness: 50, color: 'inverse' }
      ]
    },
    { name: 'day', navico: [{ group: 'default', brightness: 100, palette: 'day' }], raymarine: [{ group: 'helm1', brightness: 100, color: 'day1' }] }]
  }

  it('does not apply display settings or subscribe to automatic sources on start', function () {
    const f = fixture(presets, { groupMappings: [{ raymarineGroup: 'helm1', simradGroup: 'default' }] })
    assert.deepStrictEqual(vendorValues(f.messages), [])
    assert.strictEqual(f.subscriptions, 0)
  })

  it('applies each selected group once with exact brightness and palette', function () {
    const f = fixture(presets)
    f.messages.length = 0
    const result = f.puts['electrical.displays.preset']('vessels.self', '', 'night')
    assert.strictEqual(result.statusCode, 200)
    assert.deepStrictEqual(vendorValues(f.messages), [
      { path: 'electrical.displays.navico.default.nightMode.state', value: 1 },
      { path: 'electrical.displays.navico.default.brightness', value: 0.66 },
      { path: 'electrical.displays.raymarine.helm1.color', value: 'red/black' },
      { path: 'electrical.displays.raymarine.helm1.brightness', value: 0.4 },
      { path: 'electrical.displays.raymarine.cockpit.color', value: 'inverse' },
      { path: 'electrical.displays.raymarine.cockpit.brightness', value: 0.5 }
    ])
    assert.strictEqual(values(f.messages).filter(v => v.path === 'electrical.displays.preset').length, 1)
  })

  it('applies the day preset without touching groups omitted from it', function () {
    const f = fixture(presets)
    f.messages.length = 0
    assert.strictEqual(f.puts['electrical.displays.preset']('', '', 'day').statusCode, 200)
    assert.deepStrictEqual(vendorValues(f.messages), [
      { path: 'electrical.displays.navico.default.nightMode.state', value: 0 },
      { path: 'electrical.displays.navico.default.brightness', value: 1 },
      { path: 'electrical.displays.raymarine.helm1.color', value: 'day1' },
      { path: 'electrical.displays.raymarine.helm1.brightness', value: 1 }
    ])
  })

  it('rejects bad or disabled groups before publishing anything', function () {
    const bad = { enabled: true, profiles: [{ name: 'night', navico: [{ group: 'default', brightness: 66, palette: 'night' }], raymarine: [{ group: 'helm1', brightness: 50, color: 'invalid' }] }] }
    const f = fixture(bad)
    f.messages.length = 0
    assert.strictEqual(f.puts['electrical.displays.preset']('', '', 'night').statusCode, 400)
    assert.deepStrictEqual(values(f.messages), [])
    const g = fixture(presets, { raymarineGroups: { cockpit: false } })
    g.messages.length = 0
    assert.strictEqual(g.puts['electrical.displays.preset']('', '', 'night').statusCode, 400)
    assert.deepStrictEqual(values(g.messages), [])
  })

  it('rejects duplicates and out-of-range values before publishing', function () {
    for (const rows of [
      [{ group: 'default', brightness: 66 }, { group: 'default', brightness: 20 }],
      [{ group: 'default', brightness: 101 }],
      [{ group: 'default', brightness: 1.5 }]
    ]) {
      const f = fixture({ enabled: true, profiles: [{ name: 'night', navico: rows.map(row => ({ ...row, palette: 'night' })) }] })
      f.messages.length = 0
      assert.strictEqual(f.puts['electrical.displays.preset']('', '', 'night').statusCode, 400)
      assert.deepStrictEqual(values(f.messages), [])
    }
  })

  it('blocks legacy intent and compat PUTs while presets are active', function () {
    const f = fixture(presets)
    f.messages.length = 0
    assert.strictEqual(f.puts['electrical.displays.mode']('', '', 'night').statusCode, 409)
    assert.strictEqual(f.puts['electrical.displays.control']('', '', 'auto').statusCode, 409)
    assert.strictEqual(f.puts['environment.displayMode.control']('', '', { mode: 'night', backlight: 4 }).statusCode, 409)
    assert.deepStrictEqual(values(f.messages), [])
  })

  it('rejects preset PUTs when not enabled', function () {
    const f = fixture({ enabled: false })
    f.messages.length = 0
    assert.strictEqual(f.puts['electrical.displays.preset']('', '', 'day').statusCode, 409)
    assert.deepStrictEqual(values(f.messages), [])
  })
})
