// c:\Users\Anas\Desktop\backend\__tests__\models\Pet.test.js

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Pet = require('../../models/Pet'); 

let mongoServer;

// --- Test Setup ---
beforeAll(async () => {
  // Start the in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Disconnect any existing connection and connect to the in-memory server
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  // Disconnect Mongoose and stop the in-memory server
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear the Pet collection before each test
  await Pet.deleteMany({});
});
// --- End Test Setup ---


// --- Test Suite ---
describe('Pet Model', () => {

  // Helper function to create valid pet data
  const createValidPetData = () => ({
    name: 'Buddy',
    ageYears: 2,
    ageMonths: 6,
    weight: 15.5,
    species: 'Dog',
    gender: 'Male',
    breed: 'Golden Retriever',
    medicalInfo: 'Allergic to peanuts',
    owner: new mongoose.Types.ObjectId(), // Generate a valid ObjectId for the owner
    // pictures is optional, defaults to []
  });

  it('should create and save a pet successfully with valid data', async () => {
    const validData = createValidPetData();
    const pet = new Pet(validData);
    const savedPet = await pet.save();

    // Assertions
    expect(savedPet._id).toBeDefined();
    expect(savedPet.name).toBe(validData.name);
    expect(savedPet.ageYears).toBe(validData.ageYears);
    expect(savedPet.ageMonths).toBe(validData.ageMonths);
    expect(savedPet.weight).toBe(validData.weight);
    expect(savedPet.species).toBe(validData.species);
    expect(savedPet.gender).toBe(validData.gender);
    expect(savedPet.breed).toBe(validData.breed);
    expect(savedPet.medicalInfo).toBe(validData.medicalInfo);
    expect(savedPet.owner).toEqual(validData.owner);
    expect(savedPet.pictures).toEqual([]); // Check default value
    expect(savedPet.createdAt).toBeDefined();
    expect(savedPet.updatedAt).toBeDefined();
  });

  it('should trim whitespace from name and medicalInfo', async () => {
    const dataWithWhitespace = {
      ...createValidPetData(),
      name: '  Fluffy  ',
      medicalInfo: '  Needs regular grooming  ',
    };
    const pet = new Pet(dataWithWhitespace);
    const savedPet = await pet.save();

    expect(savedPet.name).toBe('Fluffy');
    expect(savedPet.medicalInfo).toBe('Needs regular grooming');
  });

  // Test required fields
  const requiredFields = ['name', 'ageYears', 'ageMonths', 'weight', 'species', 'gender', 'breed', 'owner'];
  requiredFields.forEach((field) => {
    it(`should fail to save if required field "${field}" is missing`, async () => {
      const invalidData = createValidPetData();
      delete invalidData[field]; // Remove the required field
      const pet = new Pet(invalidData);

      // Expect save() to reject with a ValidationError
      await expect(pet.save()).rejects.toThrow(mongoose.Error.ValidationError);

      // More specific check (optional):
      try {
        await pet.save();
      } catch (error) {
        expect(error.errors[field]).toBeDefined();
      }
    });
  });

  // Test enum validation
  it('should fail to save with invalid species', async () => {
    const invalidData = { ...createValidPetData(), species: 'Bird' };
    const pet = new Pet(invalidData);
    await expect(pet.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await pet.save(); } catch (error) { expect(error.errors.species).toBeDefined(); }
  });

  it('should fail to save with invalid gender', async () => {
    const invalidData = { ...createValidPetData(), gender: 'Unknown' };
    const pet = new Pet(invalidData);
    await expect(pet.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await pet.save(); } catch (error) { expect(error.errors.gender).toBeDefined(); }
  });

  // Test number constraints
  it('should fail to save with negative ageYears', async () => {
    const invalidData = { ...createValidPetData(), ageYears: -1 };
    const pet = new Pet(invalidData);
    await expect(pet.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await pet.save(); } catch (error) { expect(error.errors.ageYears).toBeDefined(); }
  });

  it('should fail to save with negative ageMonths', async () => {
    const invalidData = { ...createValidPetData(), ageMonths: -2 };
    const pet = new Pet(invalidData);
    await expect(pet.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await pet.save(); } catch (error) { expect(error.errors.ageMonths).toBeDefined(); }
  });

  it('should fail to save with ageMonths greater than 11', async () => {
    const invalidData = { ...createValidPetData(), ageMonths: 12 };
    const pet = new Pet(invalidData);
    await expect(pet.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await pet.save(); } catch (error) { expect(error.errors.ageMonths).toBeDefined(); }
  });

  it('should fail to save with negative weight', async () => {
    const invalidData = { ...createValidPetData(), weight: -5 };
    const pet = new Pet(invalidData);
    await expect(pet.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await pet.save(); } catch (error) { expect(error.errors.weight).toBeDefined(); }
  });

});
// --- End Test Suite ---
