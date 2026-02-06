#!/usr/bin/env node
/**
 * 验证密码哈希脚本
 * 用于调试密码验证问题
 */

const crypto = require('crypto');

// 从数据库获取的密码哈希（需要替换为实际值）
const storedHash = process.argv[2];
const testPassword = process.argv[3] || 'test123456';

if (!storedHash) {
  console.error('用法: node verify-password-hash.js <stored_hash> [test_password]');
  process.exit(1);
}

console.log('==========================================');
console.log('密码哈希验证调试');
console.log('==========================================');
console.log('');
console.log('存储的哈希:', storedHash.substring(0, 50) + '...');
console.log('测试密码:', testPassword);
console.log('');

// 解析哈希
if (!storedHash || storedHash.trim() === '' || !storedHash.includes(':')) {
  console.error('❌ 无效的哈希格式');
  process.exit(1);
}

const [salt, iterations, storedHashValue] = storedHash.split(':');

console.log('哈希格式检查:');
console.log('  Salt 长度:', salt.length);
console.log('  Iterations:', iterations);
console.log('  Hash 长度:', storedHashValue.length);
console.log('');

// 验证格式
if (!salt || !iterations || !storedHashValue) {
  console.error('❌ 哈希格式错误：缺少部分');
  process.exit(1);
}

const iterCount = parseInt(iterations, 10);
if (isNaN(iterCount) || iterCount <= 0) {
  console.error('❌ 无效的迭代次数:', iterations);
  process.exit(1);
}

console.log('格式验证: ✅');
console.log('');

// 计算密码哈希
console.log('计算密码哈希...');
const keylen = 64;
const digest = 'sha512';

try {
  const derivedKey = crypto.pbkdf2Sync(testPassword, salt, iterCount, keylen, digest);
  const derivedHash = derivedKey.toString('hex');
  
  console.log('计算的哈希:', derivedHash.substring(0, 50) + '...');
  console.log('存储的哈希:', storedHashValue.substring(0, 50) + '...');
  console.log('');
  
  const isValid = derivedHash === storedHashValue;
  
  if (isValid) {
    console.log('✅ 密码匹配！');
  } else {
    console.log('❌ 密码不匹配！');
    console.log('');
    console.log('可能的原因:');
    console.log('  1. 密码不正确');
    console.log('  2. 哈希格式有问题');
    console.log('  3. 数据库中的哈希值损坏');
  }
} catch (error) {
  console.error('❌ 计算哈希时出错:', error.message);
  process.exit(1);
}
