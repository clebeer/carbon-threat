/**
 * Unit tests — services/siemDeliveryService.js
 *
 * Uses sinon stubs instead of real HTTP or DB calls.
 */

import { describe, it, before, after, beforeEach } from 'mocha';
import { strict as assert } from 'assert';
import sinon from 'sinon';

// We import deliverToSiems via a dynamic import after patching fetch
let deliverToSiems;

const SAMPLE_ENTRY = {
  id: 1, action: 'USER_CREATE', entity_type: 'USER', entity_id: 'u-1',
  user_id: 'admin-uuid', ip_address: '127.0.0.1', http_status: 201,
  created_at: new Date().toISOString(),
};

// Minimal stub knex — returns no rows by default
function makeKnexStub(rows = []) {
  const builder = {
    whereIn: () => builder,
    where:   () => builder,
    then: (resolve) => resolve(rows),
    [Symbol.iterator]: undefined,
  };
  builder[Symbol.for('nodejs.util.inspect.custom')] = () => 'KnexStub';
  return () => builder;
}

describe('siemDeliveryService', () => {
  before(async () => {
    // Load after patching global fetch
    global.fetch = sinon.stub().resolves({ ok: true, text: async () => '' });
    const mod = await import('../../src/services/siemDeliveryService.js');
    deliverToSiems = mod.deliverToSiems;
  });

  beforeEach(() => {
    global.fetch.resetHistory();
  });

  after(() => {
    delete global.fetch;
  });

  it('is a no-op when no SIEM integrations are configured', async () => {
    const knex = makeKnexStub([]);
    await deliverToSiems(SAMPLE_ENTRY, knex);
    // Give setImmediate a tick
    await new Promise(r => setImmediate(r));
    assert.equal(global.fetch.callCount, 0);
  });

  it('does NOT throw when delivery fails (fire-and-forget)', async () => {
    global.fetch.rejects(new Error('network failure'));

    // Return a row that looks like a webhook config
    const fakeConfig = { apiKey: 'test', config_encrypted: null };
    const knex = makeKnexStub([
      { platform: 'webhook', is_enabled: true, config_encrypted: '{}' },
    ]);
    // deliverToSiems should still resolve even if fetch throws
    await assert.doesNotReject(() => deliverToSiems(SAMPLE_ENTRY, knex));
  });
});
