import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface UserData {
  email: string;
  firstName: string;
  password: string;
}

const users: UserData[] = [
  { email: 'abiola@miela.cc', firstName: 'Abiola', password: 'Miela2025!Admin' },
  { email: 'felipe@miela.cc', firstName: 'Felipe', password: 'Felipe2025!Miela' },
  { email: 'juan@miela.cc', firstName: 'Juan', password: 'Juan2025!Miela' },
  { email: 'carlos@miela.cc', firstName: 'Carlos', password: 'Carlos2025!Miela' },
  { email: 'pedro@miela.cc', firstName: 'Pedro', password: 'Pedro2025!Miela' },
  { email: 'jorge@miela.cc', firstName: 'Jorge', password: 'Jorge2025!Miela' },
  { email: 'tabata@miela.cc', firstName: 'Tabata', password: 'Tabata2025!Miela' },
  { email: 'nicolas@miela.cc', firstName: 'Nicolas', password: 'Nicolas2025!Miela' },
  { email: 'pm@mieladigital.com', firstName: 'Fabricio', password: 'Fabricio2025!Miela' }
];

async function createUsers() {
  console.log('Creating users...\n');

  for (const userData of users) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        console.log(`✓ User ${userData.email} already exists`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          firstName: userData.firstName,
          password: hashedPassword,
          mfaEnabled: false,
        },
      });

      console.log(`✓ Created user: ${user.email}`);
      console.log(`  Password: ${userData.password}\n`);
    } catch (error) {
      console.error(`✗ Failed to create user ${userData.email}:`, error);
    }
  }

  console.log('\n=== USER CREDENTIALS ===\n');
  users.forEach(user => {
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${user.password}\n`);
  });
}

createUsers()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
