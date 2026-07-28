-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "timezone" TEXT NOT NULL,
    "entityId" TEXT,
    "payloadJson" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "revokesId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "event_schemas" (
    "kind" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "jsonSchema" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("kind", "schemaVersion")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capturedAt" DATETIME,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" INTEGER,
    "bytes" INTEGER,
    "exifStripped" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "asset_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "predicate" TEXT NOT NULL,
    "eventId" TEXT,
    "exerciseSetId" TEXT,
    "mealId" TEXT,
    "entityId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_links_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "asset_links_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "asset_links_exerciseSetId_fkey" FOREIGN KEY ("exerciseSetId") REFERENCES "exercise_sets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "asset_links_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "meals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "relations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "predicate" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "muscleGroup" TEXT,
    "movement" TEXT,
    "equipment" TEXT,
    "entityId" TEXT,
    "isUnilateral" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'app:gym',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "workout_routines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "suggestedDays" TEXT,
    "estimatedMin" INTEGER,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'app:gym',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "routine_exercises" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "targetSets" INTEGER,
    "targetReps" TEXT,
    "restSec" INTEGER,
    "targetRir" INTEGER,
    "notes" TEXT,
    CONSTRAINT "routine_exercises_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "workout_routines" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "routine_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineId" TEXT,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "timezone" TEXT NOT NULL,
    "placeEntityId" TEXT,
    "energyBefore" INTEGER,
    "rpe" INTEGER,
    "notes" TEXT,
    "volumeKg" REAL,
    "setCount" INTEGER,
    "durationMin" INTEGER,
    "eventId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL DEFAULT 'app:gym',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "workout_sessions_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "workout_routines" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "exercise_sets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setIndex" INTEGER NOT NULL,
    "setType" TEXT NOT NULL DEFAULT 'work',
    "reps" INTEGER,
    "weightKg" REAL,
    "rir" INTEGER,
    "durationSec" INTEGER,
    "distanceM" REAL,
    "notes" TEXT,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exercise_sets_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workout_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "exercise_sets_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "foods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "entityId" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "kcal" REAL,
    "proteinG" REAL,
    "carbsG" REAL,
    "fatG" REAL,
    "fiberG" REAL,
    "barcode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'app:food',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mealType" TEXT,
    "servings" REAL NOT NULL DEFAULT 1,
    "prepMinutes" INTEGER,
    "notes" TEXT,
    "entityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'app:food',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "preparation" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "recipe_ingredients_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recipe_ingredients_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT,
    "mealType" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "timezone" TEXT NOT NULL,
    "placeEntityId" TEXT,
    "hungerBefore" INTEGER,
    "fullnessAfter" INTEGER,
    "notes" TEXT,
    "kcal" REAL,
    "proteinG" REAL,
    "carbsG" REAL,
    "fatG" REAL,
    "eventId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL DEFAULT 'app:food',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "meals_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meal_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mealId" TEXT NOT NULL,
    "foodId" TEXT,
    "name" TEXT NOT NULL,
    "amount" REAL,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "kcal" REAL,
    "proteinG" REAL,
    "carbsG" REAL,
    "fatG" REAL,
    "notes" TEXT,
    CONSTRAINT "meal_items_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "meals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "meal_items_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daily_metrics" (
    "date" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" REAL,
    "valueText" TEXT,
    "unit" TEXT,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("date", "metric")
);

-- CreateTable
CREATE TABLE "entity_stats" (
    "entityId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" REAL,
    "valueText" TEXT,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("entityId", "metric")
);

-- CreateIndex
CREATE INDEX "events_startedAt_idx" ON "events"("startedAt");

-- CreateIndex
CREATE INDEX "events_kind_startedAt_idx" ON "events"("kind", "startedAt");

-- CreateIndex
CREATE INDEX "events_domain_startedAt_idx" ON "events"("domain", "startedAt");

-- CreateIndex
CREATE INDEX "events_entityId_idx" ON "events"("entityId");

-- CreateIndex
CREATE INDEX "events_revokesId_idx" ON "events"("revokesId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_storageKey_key" ON "assets"("storageKey");

-- CreateIndex
CREATE INDEX "assets_checksum_idx" ON "assets"("checksum");

-- CreateIndex
CREATE INDEX "asset_links_assetId_idx" ON "asset_links"("assetId");

-- CreateIndex
CREATE INDEX "asset_links_eventId_idx" ON "asset_links"("eventId");

-- CreateIndex
CREATE INDEX "asset_links_entityId_idx" ON "asset_links"("entityId");

-- CreateIndex
CREATE INDEX "relations_objectId_idx" ON "relations"("objectId");

-- CreateIndex
CREATE UNIQUE INDEX "relations_subjectId_predicate_objectId_key" ON "relations"("subjectId", "predicate", "objectId");

-- CreateIndex
CREATE UNIQUE INDEX "exercises_name_key" ON "exercises"("name");

-- CreateIndex
CREATE UNIQUE INDEX "workout_routines_name_key" ON "workout_routines"("name");

-- CreateIndex
CREATE INDEX "routine_exercises_routineId_sortOrder_idx" ON "routine_exercises"("routineId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "routine_exercises_routineId_exerciseId_key" ON "routine_exercises"("routineId", "exerciseId");

-- CreateIndex
CREATE INDEX "workout_sessions_startedAt_idx" ON "workout_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "workout_sessions_endedAt_idx" ON "workout_sessions"("endedAt");

-- CreateIndex
CREATE INDEX "exercise_sets_exerciseId_completedAt_idx" ON "exercise_sets"("exerciseId", "completedAt");

-- CreateIndex
CREATE INDEX "exercise_sets_sessionId_setIndex_idx" ON "exercise_sets"("sessionId", "setIndex");

-- CreateIndex
CREATE UNIQUE INDEX "foods_name_key" ON "foods"("name");

-- CreateIndex
CREATE INDEX "foods_barcode_idx" ON "foods"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_name_key" ON "recipes"("name");

-- CreateIndex
CREATE INDEX "recipe_ingredients_recipeId_sortOrder_idx" ON "recipe_ingredients"("recipeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_ingredients_recipeId_foodId_key" ON "recipe_ingredients"("recipeId", "foodId");

-- CreateIndex
CREATE INDEX "meals_startedAt_idx" ON "meals"("startedAt");

-- CreateIndex
CREATE INDEX "meal_items_mealId_idx" ON "meal_items"("mealId");

-- CreateIndex
CREATE INDEX "daily_metrics_metric_date_idx" ON "daily_metrics"("metric", "date");
