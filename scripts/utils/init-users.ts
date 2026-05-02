#!/usr/bin/env tsx
/**
 * 初始化用户账户脚本
 * 创建各角色的默认账号（管理员、摄影师、修图师、访客）
 * 
 * 使用方法:
 *   pnpm init-users
 *   pnpm exec tsx scripts/utils/init-users.ts
 *   tsx scripts/utils/init-users.ts
 * 
 * 环境变量配置（可选，用于自定义邮箱域名）:
 *   INIT_ADMIN_EMAIL - 管理员邮箱（默认: admin@localhost）
 *   INIT_PHOTOGRAPHER_EMAIL - 摄影师邮箱（默认: photographer@pis.com）
 *   INIT_RETOUCHER_EMAIL - 修图师邮箱（默认: retoucher@pis.com）
 *   INIT_GUEST_EMAIL - 访客邮箱（默认: guest@pis.com）
 *   INIT_DEFAULT_PASSWORD - 默认密码（可选，留空则首次登录时设置）
 */

import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载环境变量
const rootEnvPath = join(__dirname, '../../.env')
const scriptsEnvPath = join(__dirname, '../.env')
if (require('fs').existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath })
} else if (require('fs').existsSync(scriptsEnvPath)) {
  dotenv.config({ path: scriptsEnvPath })
} else {
  dotenv.config()
}

// 密码哈希函数
import { pbkdf2, randomBytes } from 'crypto'
import { promisify } from 'util'

const pbkdf2Async = promisify(pbkdf2)

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32).toString('hex')
  const iterations = 100000
  const keylen = 64
  const digest = 'sha512'
  
  const derivedKey = await pbkdf2Async(password, salt, iterations, keylen, digest)
  return `${salt}:${iterations}:${derivedKey.toString('hex')}`
}

// 数据库客户端
async function createUser(
  email: string, 
  passwordHash: string | null,
  role: 'admin' | 'photographer' | 'retoucher' | 'guest'
): Promise<{ created: boolean; email: string; role: string }> {
  const { Client } = await import('pg')
  
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: process.env.DATABASE_NAME || 'pis',
    user: process.env.DATABASE_USER || 'pis',
    password: process.env.DATABASE_PASSWORD || '',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  })
  
  await client.connect()
  
  try {
    // 检查用户是否已存在
    const checkResult = await client.query(
      'SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase()]
    )
    
    if (checkResult.rows.length > 0) {
      return { created: false, email, role }
    }
    
    // 创建新用户
    const result = await client.query(
      `INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email`,
      [email.toLowerCase(), passwordHash, role, true]
    )
    
    return { created: result.rows.length > 0, email, role }
  } finally {
    await client.end()
  }
}

// 角色配置
interface UserConfig {
  role: 'admin' | 'photographer' | 'retoucher' | 'guest'
  email: string
  label: string
}

const roleLabels: Record<string, string> = {
  admin: '管理员',
  photographer: '摄影师',
  retoucher: '修图师',
  guest: '访客',
}

async function initUsers() {
  console.log('🚀 开始初始化用户账户...\n')

  // 检查数据库配置
  if (!process.env.DATABASE_HOST && !process.env.DATABASE_URL) {
    console.error('❌ 未找到数据库配置')
    console.error('   请确保 .env 文件中包含 DATABASE_HOST 或 DATABASE_URL')
    process.exit(1)
  }

  // 获取默认密码（可选）
  const defaultPassword = process.env.INIT_DEFAULT_PASSWORD || ''
  let passwordHash: string | null = null
  
  if (defaultPassword && defaultPassword.length > 0) {
    if (defaultPassword.length < 8) {
      console.error('❌ 默认密码至少需要 8 个字符')
      process.exit(1)
    }
    console.log('🔐 正在哈希默认密码...')
    passwordHash = await hashPassword(defaultPassword)
  }

  // 定义各角色的邮箱
  const users: UserConfig[] = [
    {
      role: 'admin',
      email: process.env.INIT_ADMIN_EMAIL || 'admin@localhost',
      label: roleLabels.admin,
    },
    {
      role: 'photographer',
      email: process.env.INIT_PHOTOGRAPHER_EMAIL || 'photographer@pis.com',
      label: roleLabels.photographer,
    },
    {
      role: 'retoucher',
      email: process.env.INIT_RETOUCHER_EMAIL || 'retoucher@pis.com',
      label: roleLabels.retoucher,
    },
    {
      role: 'guest',
      email: process.env.INIT_GUEST_EMAIL || 'guest@pis.com',
      label: roleLabels.guest,
    },
  ]

  console.log('📋 准备创建以下用户账户:\n')
  users.forEach((user) => {
    console.log(`   - ${user.label} (${user.role}): ${user.email}`)
  })
  console.log('')

  // 创建所有用户
  const results: Array<{ created: boolean; email: string; role: string; label: string }> = []
  
  for (const user of users) {
    try {
      const result = await createUser(user.email, passwordHash, user.role)
      results.push({ ...result, label: user.label })
    } catch (error) {
      console.error(`❌ 创建 ${user.label} 账户失败:`, error instanceof Error ? error.message : String(error))
      results.push({ created: false, email: user.email, role: user.role, label: user.label })
    }
  }

  // 显示结果
  console.log('\n📊 初始化结果:\n')
  
  const created = results.filter((r) => r.created)
  const existing = results.filter((r) => !r.created)
  
  if (created.length > 0) {
    console.log('✅ 成功创建的用户:')
    created.forEach((r) => {
      console.log(`   - ${r.label} (${r.role}): ${r.email}`)
    })
    console.log('')
  }
  
  if (existing.length > 0) {
    console.log('ℹ️  已存在的用户（跳过）:')
    existing.forEach((r) => {
      console.log(`   - ${r.label} (${r.role}): ${r.email}`)
    })
    console.log('')
  }

  // 显示登录信息
  console.log('📝 登录信息:\n')
  console.log('   访问登录页面: http://localhost:3000/admin/login\n')
  
  if (passwordHash) {
    console.log('   ⚠️  所有账户使用相同的默认密码（请尽快修改）')
    console.log(`   默认密码: ${defaultPassword}\n`)
  } else {
    console.log('   ⚠️  所有账户密码未设置，首次登录时需要设置密码\n')
  }
  
  console.log('   账户列表:')
  results.forEach((r) => {
    console.log(`   - ${r.email} (${r.label})`)
  })
  
  console.log('\n✅ 用户账户初始化完成！\n')
}

// 运行脚本
if (require.main === module) {
  initUsers().catch((error) => {
    console.error('❌ 脚本执行失败:', error)
    process.exit(1)
  })
}

export { initUsers }
