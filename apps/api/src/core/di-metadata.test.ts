import { describe, expect, it } from 'vitest'
import { Injectable } from '@nestjs/common'
import { Test } from '@nestjs/testing'

/**
 * Guards the test toolchain (ADR-0025): NestJS resolves this constructor by the
 * parameter's *type*, which only works if `emitDecoratorMetadata` reached the
 * test transform (SWC). If Vitest ever stops emitting decorator metadata, this
 * fails loudly here instead of silently breaking every module test.
 */
@Injectable()
class Dep {
  readonly value = 42
}

@Injectable()
class Consumer {
  constructor(readonly dep: Dep) {}
}

describe('nest DI metadata', () => {
  it('ResolvesConstructorByType_FromEmittedDecoratorMetadata', async () => {
    const moduleRef = await Test.createTestingModule({ providers: [Dep, Consumer] }).compile()
    const consumer = moduleRef.get(Consumer)
    expect(consumer.dep).toBeInstanceOf(Dep)
    expect(consumer.dep.value).toBe(42)
  })
})
