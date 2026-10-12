import { BadRequestException } from '@nestjs/common';
import { TicketNumberPipe } from './ticket-number.pipe.js';

describe('TicketNumberPipe', () => {
  const pipe = new TicketNumberPipe();

  it.each([
    ['1', 1],
    ['42', 42],
    ['2147483647', 2_147_483_647],
  ])('convertit %s en nombre', (value, expected) => {
    expect(pipe.transform(value)).toBe(expected);
  });

  it.each(['0', '-1', '01', '1.5', '1e3', 'abc', '', '2147483648'])('refuse %s (400)', (value) => {
    expect(() => pipe.transform(value)).toThrow(BadRequestException);
  });
});
