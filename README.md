# Arquitectura por capas con Express + Prisma
### Guía de referencia (ejemplo con `Student`, para aplicar tú mismo a `Hunter`/`Monster`/`Quest`/`Guild`)

---

## 1. ¿De qué va esto realmente?

Un CRUD "a lo bruto" es meter todo en el controlador:

```js
app.post('/students', async (req, res) => {
  const student = await prisma.student.create({ data: req.body });
  res.json(student);
});
```

Funciona para Sprint 1. Se rompe en Sprint 2, cuando aparezcan reglas de negocio,
relaciones, cálculos de recompensas, validaciones cruzadas, etc.

La arquitectura por capas separa **4 responsabilidades** que no deberían mezclarse:

| Capa | Pregunta que responde | Depende de |
|---|---|---|
| **Controller** | ¿Qué llegó por HTTP y qué respondo? | Service |
| **Service** | ¿Es válido esto según las reglas de negocio? ¿Qué orquesto? | Repository |
| **Repository** | ¿Cómo lo guardo/leo de la base de datos? | Prisma |
| **Entity / DTO** | ¿Cómo se ve el dato en cada frontera? | Nada, son solo formas |

La regla de oro: **cada capa solo conoce a la de abajo, nunca se salta capas ni conoce a la de arriba.**
El controlador jamás debería importar `PrismaClient` directamente.

¿Por qué te conviene esto y no es solo "buena onda académica"?

1. **Testeas el Service sin base de datos** (mockeas el Repository). Eso es justo lo que pide tu
   rúbrica: "Unit Tests / Service Tests" con cobertura 80%, sin tener que levantar MySQL en cada test.
2. **Si mañana cambias de Prisma a otro ORM**, o agregas caché, solo tocas el Repository.
3. **Las reglas de negocio quedan en un solo lugar** (Service), no repartidas entre controlador y validaciones sueltas.

---

## 2. Ejemplo completo: `Student`

Estructura de carpetas sugerida:

```
src/
  modules/
    student/
      student.repository.ts
      student.service.ts
      student.controller.ts
      student.routes.ts
      student.dto.ts
      student.errors.ts
  shared/
    errors/
      AppError.ts
  prisma/
    client.ts
  app.ts
  server.ts
prisma/
  schema.prisma
tests/
  student.service.test.ts
```

### 2.1 Prisma schema

```prisma
// prisma/schema.prisma
model Student {
  id        String   @id @default(uuid())
  name      String
  age       Int
  email     String   @unique
  createdAt DateTime @default(now())
}
```

Nota: Prisma ya te da el `id UUID`, timestamps, y a nivel de BD el `@unique`. Eso es
"gratis". Lo que Prisma **no** valida por ti son reglas de negocio como "age >= 18" o
"dangerLevel entre 1 y 10" — eso es dominio, no esquema de datos.

### 2.2 DTOs (lo que entra y sale por la API, no necesariamente igual al modelo de BD)

```ts
// student.dto.ts
export interface CreateStudentDto {
  name: string;
  age: number;
  email: string;
}

export interface UpdateStudentDto {
  name?: string;
  age?: number;
  email?: string;
}

// Lo que exponemos hacia afuera. Aquí, por ejemplo, decidimos no
// devolver createdAt si no queremos exponerlo, o renombrar algo.
export interface StudentResponseDto {
  id: string;
  name: string;
  age: number;
  email: string;
}
```

Con un modelo tan simple, el DTO de salida es casi idéntico al modelo de Prisma. Pero
en `Quest`, por ejemplo, tal vez quieras devolver el nombre del monstruo además del
`monsterId` — ahí el DTO ya no es igual al modelo, y el mapper cobra sentido (ver 2.9).

### 2.3 Errores de dominio (para no usar `throw new Error("string")` genérico)

```ts
// shared/errors/AppError.ts
export class AppError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}
```

Esto te permite, en un middleware de errores centralizado, mapear `statusCode` sin
que cada controlador tenga que decidir "esto es un 404 o un 400".

### 2.4 Repository — SOLO acceso a datos, cero lógica de negocio

```ts
// student.repository.ts
import { PrismaClient, Student } from '@prisma/client';
import { CreateStudentDto, UpdateStudentDto } from './student.dto';

export class StudentRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(): Promise<Student[]> {
    return this.prisma.student.findMany();
  }

  findById(id: string): Promise<Student | null> {
    return this.prisma.student.findUnique({ where: { id } });
  }

  create(data: CreateStudentDto): Promise<Student> {
    return this.prisma.student.create({ data });
  }

  update(id: string, data: UpdateStudentDto): Promise<Student> {
    return this.prisma.student.update({ where: { id }, data });
  }

  delete(id: string): Promise<Student> {
    return this.prisma.student.delete({ where: { id } });
  }
}
```

Fíjate: no hay `if (age < 18) throw ...` aquí. El repositorio no sabe qué es "válido",
solo sabe hablar con la base de datos. Eso es intencional.

### 2.5 Service — donde vive la lógica de negocio

```ts
// student.service.ts
import { StudentRepository } from './student.repository';
import { CreateStudentDto, UpdateStudentDto, StudentResponseDto } from './student.dto';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';

export class StudentService {
  constructor(private repository: StudentRepository) {}

  private toResponseDto(student: any): StudentResponseDto {
    return { id: student.id, name: student.name, age: student.age, email: student.email };
  }

  private validate(data: Partial<CreateStudentDto>) {
    if (data.name !== undefined && data.name.trim() === '') {
      throw new ValidationError('Name is required');
    }
    if (data.age !== undefined && data.age < 0) {
      throw new ValidationError('Age must be >= 0');
    }
  }

  async getAll(): Promise<StudentResponseDto[]> {
    const students = await this.repository.findAll();
    return students.map(this.toResponseDto);
  }

  async getById(id: string): Promise<StudentResponseDto> {
    const student = await this.repository.findById(id);
    if (!student) throw new NotFoundError('Student', id);
    return this.toResponseDto(student);
  }

  async create(data: CreateStudentDto): Promise<StudentResponseDto> {
    this.validate(data);
    const student = await this.repository.create(data);
    return this.toResponseDto(student);
  }

  async update(id: string, data: UpdateStudentDto): Promise<StudentResponseDto> {
    this.validate(data);
    await this.getById(id); // lanza NotFoundError si no existe
    const student = await this.repository.update(id, data);
    return this.toResponseDto(student);
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.repository.delete(id);
  }
}
```

Aquí es donde en tu proyecto real irían cosas como:
"Danger Level entre 1 y 10", "Quest.monsterId debe existir" (esto último implica que
`QuestService` va a necesitar inyectar también un `MonsterRepository` para chequear
existencia — ese es un ejemplo real de orquestación entre entidades que solo puede
vivir en el Service, nunca en el Repository).

### 2.6 Controller — SOLO traducir HTTP ↔ Service

```ts
// student.controller.ts
import { Request, Response, NextFunction } from 'express';
import { StudentService } from './student.service';

export class StudentController {
  constructor(private service: StudentService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const students = await this.service.getAll();
      res.json(students);
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const student = await this.service.getById(req.params.id);
      res.json(student);
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const student = await this.service.create(req.body);
      res.status(201).json(student);
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const student = await this.service.update(req.params.id, req.body);
      res.json(student);
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id);
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
```

El controlador no sabe qué es Prisma. No sabe qué es "válido". Solo sabe:
recibir request → llamar service → devolver response, o pasar el error al `next()`.

### 2.7 Routes + wiring manual (sin librerías de DI, para que entiendas el cableado)

```ts
// student.routes.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { StudentRepository } from './student.repository';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';

const prisma = new PrismaClient();
const repository = new StudentRepository(prisma);
const service = new StudentService(repository);
const controller = new StudentController(service);

const router = Router();
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

export default router;
```

Este cableado manual (`new Repository(...) → new Service(...) → new Controller(...)`)
es exactamente lo que te permite en los tests **no** hacer un `new StudentService(repository)`
con el repositorio real, sino con un mock.

### 2.8 Middleware de errores centralizado (en `app.ts`)

```ts
// error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError';

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
```

### 2.9 ¿Cuándo hace falta un Mapper aparte (y no solo un método privado en el Service)?

En `Student`, el mapeo es tan trivial (modelo Prisma ≈ DTO de salida) que un método
privado `toResponseDto` alcanza. Un mapper como archivo/clase separada empieza a
justificarse cuando:

- Combinas datos de varias entidades (ej. `Quest` que además de `monsterId` quiere
  devolver `monsterName` haciendo un `include` en Prisma).
- Necesitas la misma transformación en varios servicios.
- Quieres testear la transformación de forma aislada, sin levantar el service entero.

```ts
// quest.mapper.ts (ejemplo ilustrativo, no está resuelto el service)
import { Quest, Monster } from '@prisma/client';

export function toQuestResponseDto(quest: Quest & { monster: Monster }) {
  return {
    id: quest.id,
    title: quest.title,
    location: quest.location,
    reward: quest.reward,
    status: quest.status,
    monster: { id: quest.monster.id, name: quest.monster.name },
  };
}
```

---

## 3. ¿Qué te regala Prisma? ¿Qué NO?

**Te regala (no lo reimplementes):**
- Generación de tipos TypeScript por modelo (`Student`, `Prisma.StudentCreateInput`, etc.)
- Migraciones versionadas (`prisma migrate dev`)
- Query builder type-safe, sin SQL a mano
- Manejo de conexión/pool a MySQL
- Constraints a nivel de BD (`@unique`, `@id`, relaciones con `@relation`)
- Errores tipados y predecibles ante violaciones de constraint (ej. código `P2002` para
  unique constraint, `P2025` para "registro no encontrado" en update/delete)

**NO te regala (esto es tu trabajo, y es el objetivo del sprint):**
- Reglas de negocio ("dangerLevel entre 1 y 10", "reward >= 0") — Prisma no valida rangos
  a menos que los pongas como `CHECK` en el schema, y aun así la práctica estándar es
  validarlo en el Service para dar buenos mensajes de error.
- Que `Quest.monsterId` "exista" como regla de negocio explícita con un mensaje claro —
  Prisma sí te va a tirar un error de foreign key si no existe, pero es un error crudo
  de Prisma (`PrismaClientKnownRequestError`), no un `ValidationError` legible. Tu Service
  es quien decide: ¿lo valido antes con un `findById` explícito, o dejo que Prisma falle
  y traduzco el error?
- La separación entre "cómo se ve en BD" y "cómo se ve en la API" (DTOs).
- Testabilidad: sin capas, testear significa levantar una BD real o mockear Prisma
  directamente (más feo). Con Repository, mockeas una interfaz simple tuya.

---

## 4. Tests: cómo se ven en cada capa (Jest)

**Validation test** (reglas de negocio puras, sin tocar nada async):

```ts
describe('StudentService validation', () => {
  it('rejects empty name', async () => {
    const fakeRepo = {} as any;
    const service = new StudentService(fakeRepo);
    await expect(service.create({ name: '', age: 20, email: 'a@a.com' }))
      .rejects.toThrow('Name is required');
  });
});
```

**Service test con Repository mockeado** (esto es lo que te da cobertura sin BD real):

```ts
describe('StudentService.getById', () => {
  it('throws NotFoundError when student does not exist', async () => {
    const fakeRepo = { findById: jest.fn().mockResolvedValue(null) } as any;
    const service = new StudentService(fakeRepo);
    await expect(service.getById('fake-id')).rejects.toThrow('not found');
  });

  it('returns mapped student when found', async () => {
    const fakeRepo = {
      findById: jest.fn().mockResolvedValue({ id: '1', name: 'Ana', age: 20, email: 'a@a.com' }),
    } as any;
    const service = new StudentService(fakeRepo);
    const result = await service.getById('1');
    expect(result.name).toBe('Ana');
  });
});
```

Nota que **nunca importamos Prisma en estos tests**. Eso es la ganancia real de la
arquitectura: cobertura del 80% sin depender de que MySQL esté levantado en CI.

Para tests de integración (controller + Express real, opcional pero recomendable),
se usa `supertest` contra una BD de test — eso ya es otra capa de testing, no
obligatoria para llegar al 80% de unit/service tests.

---

## 5. Orden sugerido para tu Sprint 1 real

Respetando las dependencias del dominio (FK primero):

1. **Guild** (no depende de nadie) → repository, service, controller, routes, tests.
2. **Monster** (no depende de nadie) → mismo patrón.
3. **Hunter** (depende de `guildId`) → en el Service, decide si validas que el guild
   exista antes de crear el hunter, o dejas que la FK constraint de MySQL lo resuelva
   y traduces el error de Prisma a un `ValidationError`/`NotFoundError` tuyo.
4. **Quest** (depende de `monsterId`) → mismo dilema que arriba.

Repite exactamente la misma estructura de carpetas/capas que usamos en `Student` para
cada uno. Una vez que hagas `Guild` completo (repo → service → controller → routes →
tests), los otros tres son mecánicos — ahí es donde vas a notar si de verdad
entendiste el patrón o lo copiaste.

---

## 6. Preguntas para guiarte tú solo mientras programas

- ¿Este código está decidiendo *cómo consultar la BD* o *si el dato es válido*? Si es
  lo segundo y está en el Repository, está mal ubicado.
- ¿Mi Controller tiene algún `if` de negocio? Si sí, se va al Service.
- ¿Puedo testear esta función sin conexión a MySQL? Si no puedo, probablemente mezclé capas.
- Para `Quest.monsterId`: ¿valido explícitamente en el Service con un `findById`, o
  capturo el error de Prisma (`P2003` foreign key)? Ambos son válidos — pero decídelo
  a propósito, no por accidente.