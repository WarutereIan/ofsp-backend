import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Hash default password
  const hashedPassword = await bcrypt.hash('Admin123!', 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jirani-ofsp.com' },
    update: {},
    create: {
      email: 'admin@jirani-ofsp.com',
      phone: '+254700000001',
      password: hashedPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          firstName: 'System',
          lastName: 'Administrator',
          county: 'Nairobi',
          ward: 'Central',
          isVerified: true,
          verifiedAt: new Date(),
        },
      },
    },
  });

  // Create sample farmer
  const farmer = await prisma.user.upsert({
    where: { email: 'farmer@example.com' },
    update: {},
    create: {
      email: 'farmer@example.com',
      phone: '+254712345678',
      password: hashedPassword,
      role: UserRole.FARMER,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          firstName: 'John',
          lastName: 'Mwangi',
          county: 'Kiambu',
          ward: 'Gatundu North',
          village: 'Githunguri',
          farmSize: 5.5,
          isVerified: true,
          verifiedAt: new Date(),
        },
      },
    },
  });

  // Create sample buyer
  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@example.com' },
    update: {},
    create: {
      email: 'buyer@example.com',
      phone: '+254723456789',
      password: hashedPassword,
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          firstName: 'Mary',
          lastName: 'Wanjiku',
          county: 'Nairobi',
          ward: 'Westlands',
          businessName: 'Fresh Produce Ltd',
          businessRegNo: 'BUS12345',
          isVerified: true,
          verifiedAt: new Date(),
        },
      },
    },
  });

  // Create aggregation center
  const center = await prisma.aggregationCenter.upsert({
    where: { code: 'AC-001' },
    update: {},
    create: {
      name: 'Kiambu Aggregation Center',
      code: 'AC-001',
      location: 'Kiambu Town',
      county: 'Kiambu',
      coordinates: '-1.1719,36.8356',
      totalCapacity: 10000,
      currentStock: 0,
      managerName: 'Peter Kamau',
      managerPhone: '+254734567890',
      isActive: true,
    },
  });

  console.log('✅ Seeding completed!');
  console.log('\n📊 Created users:');
  console.log(`   - Admin: ${admin.email} (Password: Admin123!)`);
  console.log(`   - Farmer: ${farmer.email} (Password: Admin123!)`);
  console.log(`   - Buyer: ${buyer.email} (Password: Admin123!)`);
  console.log(`\n🏢 Created aggregation center: ${center.name}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
