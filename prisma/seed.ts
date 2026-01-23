import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Mock credentials matching the frontend MOCK_CREDENTIALS
const MOCK_USERS = [
  {
    role: UserRole.FARMER,
    email: 'john.mutua@example.com',
    phone: '+254712345678',
    password: 'farmer123',
    firstName: 'John',
    lastName: 'Mutua',
    county: 'Machakos',
    ward: 'Kangundo',
    subCounty: 'Kangundo',
  },
  {
    role: UserRole.BUYER,
    email: 'sarah.mwangi@example.com',
    phone: '+254723456789',
    password: 'buyer123',
    firstName: 'Sarah',
    lastName: 'Mwangi',
    county: 'Nairobi',
    ward: 'Westlands',
  },
  {
    role: UserRole.EXTENSION_OFFICER,
    email: 'david.kimani@example.com',
    phone: '+254734567890',
    password: 'officer123',
    firstName: 'David',
    lastName: 'Kimani',
    county: 'Machakos',
    ward: 'Kangundo',
  },
  {
    role: UserRole.STAFF,
    email: 'mary.wanjiku@example.com',
    phone: '+254745678901',
    password: 'staff123',
    firstName: 'Mary',
    lastName: 'Wanjiku',
    county: 'Nairobi',
    ward: 'Westlands',
  },
  {
    role: UserRole.AGGREGATION_MANAGER,
    email: 'peter.kariuki@example.com',
    phone: '+254756789012',
    password: 'manager123',
    firstName: 'Peter',
    lastName: 'Kariuki',
    county: 'Machakos',
    ward: 'Kangundo',
    subCounty: 'Kangundo',
  },
  {
    role: UserRole.INPUT_PROVIDER,
    email: 'grace.njeri@example.com',
    phone: '+254767890123',
    password: 'input123',
    firstName: 'Grace',
    lastName: 'Njeri',
    county: 'Nairobi',
    ward: 'Westlands',
  },
  {
    role: UserRole.TRANSPORT_PROVIDER,
    email: 'james.omondi@example.com',
    phone: '+254778901234',
    password: 'transport123',
    firstName: 'James',
    lastName: 'Omondi',
    county: 'Nairobi',
    ward: 'Westlands',
  },
  {
    role: UserRole.ADMIN,
    email: 'admin@jirani-ofsp.com',
    phone: '+254700000001',
    password: 'admin123',
    firstName: 'System',
    lastName: 'Administrator',
    county: 'Nairobi',
    ward: 'Central',
  },
];

interface CreatedUser {
  role: UserRole;
  email: string;
  phone: string;
  password: string;
  name: string;
}

async function main() {
  console.log('🌱 Seeding database with authentication users...');

  const createdUsers: CreatedUser[] = [];

  // Create all mock users
  for (const userData of MOCK_USERS) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        phone: userData.phone,
        password: hashedPassword,
        role: userData.role,
        status: UserStatus.ACTIVE,
      },
      create: {
        email: userData.email,
        phone: userData.phone,
        password: hashedPassword,
        role: userData.role,
        status: UserStatus.ACTIVE,
        profile: {
          create: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            county: userData.county,
            ward: userData.ward,
            subCounty: userData.subCounty,
            isVerified: true,
            verifiedAt: new Date(),
          },
        },
      },
      include: {
        profile: true,
      },
    });

    createdUsers.push({
      role: userData.role,
      email: user.email,
      phone: user.phone,
      password: userData.password,
      name: `${userData.firstName} ${userData.lastName}`,
    });
  }

  // Create a sample aggregation center for the aggregation manager
  const aggregationManagerUser = await prisma.user.findUnique({
    where: { email: 'peter.kariuki@example.com' },
  });

  if (aggregationManagerUser) {
    await prisma.aggregationCenter.upsert({
      where: { code: 'AC-001' },
      update: {
        managerId: aggregationManagerUser.id,
        managerName: 'Peter Kariuki',
        managerPhone: aggregationManagerUser.phone,
      },
      create: {
        name: 'Kangundo Aggregation Center',
        code: 'AC-001',
        location: 'Kangundo',
        county: 'Machakos',
        subCounty: 'Kangundo',
        coordinates: '-1.3000,37.3500',
        totalCapacity: 10000,
        currentStock: 0,
        managerId: aggregationManagerUser.id,
        managerName: 'Peter Kariuki',
        managerPhone: aggregationManagerUser.phone,
        isActive: true,
      },
    });
    console.log('\n🏢 Created aggregation center: Kangundo Aggregation Center');
  }

  console.log('✅ Seeding completed!');
  console.log('\n📊 Created users (matching frontend MOCK_CREDENTIALS):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  createdUsers.forEach((user) => {
    const roleName = user.role.replace(/_/g, ' ').toLowerCase();
    console.log(`\n👤 ${user.name} (${roleName})`);
    console.log(`   📧 Email: ${user.email}`);
    console.log(`   📱 Phone: ${user.phone}`);
    console.log(`   🔑 Password: ${user.password}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n💡 Tip: Use these credentials to login via the frontend login page.');
  console.log('   The login page will auto-fill these credentials when you click "Fill".\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
