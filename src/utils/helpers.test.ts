import { describe, it, expect } from 'vitest';
import {
  isValidIP,
  ipToInt,
  intToIp,
  isValidMask,
  maskToCidr,
  cidrToMask,
  networkAddress,
  broadcastAddress,
  sameSubnet,
  DEFAULT_MASK,
} from './helpers';

describe('isValidIP', () => {
  it('accepts well-formed dotted-quad addresses', () => {
    expect(isValidIP('0.0.0.0')).toBe(true);
    expect(isValidIP('192.168.1.1')).toBe(true);
    expect(isValidIP('255.255.255.255')).toBe(true);
    expect(isValidIP('10.1.3.100')).toBe(true);
  });

  it('rejects out-of-range octets', () => {
    expect(isValidIP('256.1.1.1')).toBe(false);
    expect(isValidIP('1.1.1.-1')).toBe(false);
    expect(isValidIP('999.0.0.0')).toBe(false);
  });

  it('rejects the wrong number of octets', () => {
    expect(isValidIP('192.168.1')).toBe(false);
    expect(isValidIP('192.168.1.1.1')).toBe(false);
    expect(isValidIP('')).toBe(false);
  });

  it('rejects non-numeric and non-canonical octets', () => {
    expect(isValidIP('a.b.c.d')).toBe(false);
    expect(isValidIP('01.2.3.4')).toBe(false); // leading zero is not canonical
    expect(isValidIP(' 192.168.1.1')).toBe(false);
  });
});

describe('ipToInt / intToIp', () => {
  it('converts known addresses to their 32-bit integer form', () => {
    expect(ipToInt('0.0.0.0')).toBe(0);
    expect(ipToInt('192.168.1.1')).toBe(0xc0a80101);
    expect(ipToInt('255.255.255.255')).toBe(0xffffffff);
  });

  it('returns null for invalid input', () => {
    expect(ipToInt('not.an.ip')).toBeNull();
    expect(ipToInt('256.0.0.1')).toBeNull();
  });

  it('renders integers back to dotted-quad', () => {
    expect(intToIp(0)).toBe('0.0.0.0');
    expect(intToIp(0xc0a80101)).toBe('192.168.1.1');
    expect(intToIp(0xffffffff)).toBe('255.255.255.255');
  });

  it('round-trips ip -> int -> ip', () => {
    for (const ip of ['10.1.3.100', '172.16.254.1', '8.8.8.8', '192.168.0.5']) {
      expect(intToIp(ipToInt(ip)!)).toBe(ip);
    }
  });
});

describe('isValidMask', () => {
  it('accepts contiguous masks', () => {
    expect(isValidMask('0.0.0.0')).toBe(true); // /0
    expect(isValidMask('128.0.0.0')).toBe(true); // /1
    expect(isValidMask('255.255.0.0')).toBe(true); // /16
    expect(isValidMask('255.255.255.0')).toBe(true); // /24
    expect(isValidMask('255.255.255.128')).toBe(true); // /25
    expect(isValidMask('255.255.255.255')).toBe(true); // /32
  });

  it('rejects non-contiguous or malformed masks', () => {
    expect(isValidMask('255.0.255.0')).toBe(false);
    expect(isValidMask('255.255.0.255')).toBe(false);
    expect(isValidMask('255.255.255.1')).toBe(false);
    expect(isValidMask('nonsense')).toBe(false);
  });

  it('treats the default mask as valid', () => {
    expect(isValidMask(DEFAULT_MASK)).toBe(true);
  });
});

describe('maskToCidr', () => {
  it('counts prefix bits for valid masks', () => {
    expect(maskToCidr('0.0.0.0')).toBe(0);
    expect(maskToCidr('255.0.0.0')).toBe(8);
    expect(maskToCidr('255.255.0.0')).toBe(16);
    expect(maskToCidr('255.255.240.0')).toBe(20);
    expect(maskToCidr('255.255.255.0')).toBe(24);
    expect(maskToCidr('255.255.255.128')).toBe(25);
    expect(maskToCidr('255.255.255.255')).toBe(32);
  });

  it('returns null for invalid masks', () => {
    expect(maskToCidr('255.0.255.0')).toBeNull();
    expect(maskToCidr('bad.mask')).toBeNull();
  });
});

describe('cidrToMask', () => {
  it('expands prefix lengths to dotted-quad masks', () => {
    expect(cidrToMask(0)).toBe('0.0.0.0');
    expect(cidrToMask(8)).toBe('255.0.0.0');
    expect(cidrToMask(16)).toBe('255.255.0.0');
    expect(cidrToMask(24)).toBe('255.255.255.0');
    expect(cidrToMask(25)).toBe('255.255.255.128');
    expect(cidrToMask(32)).toBe('255.255.255.255');
  });

  it('round-trips cidr -> mask -> cidr', () => {
    for (let cidr = 0; cidr <= 32; cidr++) {
      expect(maskToCidr(cidrToMask(cidr))).toBe(cidr);
    }
  });
});

describe('networkAddress', () => {
  it('masks the host bits to yield the network id', () => {
    expect(networkAddress('192.168.1.50', '255.255.255.0')).toBe('192.168.1.0');
    expect(networkAddress('10.1.3.100', '255.255.255.0')).toBe('10.1.3.0');
    expect(networkAddress('192.168.1.130', '255.255.255.128')).toBe('192.168.1.128');
    expect(networkAddress('192.168.1.100', '255.255.255.128')).toBe('192.168.1.0');
  });

  it('returns null when the ip or mask is invalid', () => {
    expect(networkAddress('bad', '255.255.255.0')).toBeNull();
    expect(networkAddress('192.168.1.1', 'bad')).toBeNull();
  });
});

describe('broadcastAddress', () => {
  it('sets the host bits to yield the broadcast address', () => {
    expect(broadcastAddress('192.168.1.50', '255.255.255.0')).toBe('192.168.1.255');
    expect(broadcastAddress('192.168.1.50', '255.255.255.128')).toBe('192.168.1.127');
    expect(broadcastAddress('10.0.0.1', '255.0.0.0')).toBe('10.255.255.255');
  });

  it('returns null when the ip or mask is invalid', () => {
    expect(broadcastAddress('bad', '255.255.255.0')).toBeNull();
    expect(broadcastAddress('192.168.1.1', 'bad')).toBeNull();
  });
});

describe('sameSubnet', () => {
  it('returns true for hosts sharing a network', () => {
    expect(sameSubnet('192.168.1.10', '192.168.1.200', '255.255.255.0')).toBe(true);
    // A host and its default gateway must be co-subnet (the store relies on this).
    expect(sameSubnet('10.1.1.10', '10.1.1.1', '255.255.255.0')).toBe(true);
    expect(sameSubnet('192.168.1.100', '192.168.1.10', '255.255.255.128')).toBe(true);
  });

  it('returns false across different networks', () => {
    expect(sameSubnet('192.168.1.10', '192.168.2.10', '255.255.255.0')).toBe(false);
    // The "Multi-Hop Routing" preset: 10.1.1.x host vs 10.1.3.x server is cross-subnet.
    expect(sameSubnet('10.1.1.10', '10.1.3.100', '255.255.255.0')).toBe(false);
    expect(sameSubnet('192.168.1.10', '192.168.1.130', '255.255.255.128')).toBe(false);
  });

  it('returns false when either address is invalid', () => {
    expect(sameSubnet('bad', '192.168.1.1', '255.255.255.0')).toBe(false);
    expect(sameSubnet('192.168.1.1', 'bad', '255.255.255.0')).toBe(false);
  });
});
