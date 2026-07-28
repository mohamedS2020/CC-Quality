import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing with argon2id (the algorithm chosen for this project).
 *
 * Parameters follow the OWASP minimum (19 MiB memory, 2 iterations, 1 lane).
 * argon2id is @node-rs/argon2's default algorithm, and the cost parameters are
 * encoded into the resulting hash string — so `verify()` reads them back and
 * needs no options, and raising these values later stays compatible with
 * already-stored hashes.
 *
 * This module deliberately imports nothing server-only so it can also run in
 * the standalone seed script (which provisions the bootstrap admin).
 */
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}
