const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Pet = require('../../models/Pet');

let mongoServer;

// Setup for the test environment, runs once before all tests in this file.
beforeAll(async () => {
  // Start an in-memory MongoDB server for isolated testing.
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Disconnect any existing Mongoose connection and connect to the in-memory server.
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
});

// Teardown for the test environment, runs once after all tests in this file.
afterAll(async () => {
  // Disconnect Mongoose and stop the in-memory MongoDB server.
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Runs before each test case in this file.
beforeEach(async () => {
  // Clear the Pet collection to ensure a clean state for each test.
  await Pet.deleteMany({});
});

// Test suite for the Pet Mongoose model.
describe('Pet Model', () => {

  // Helper function to generate valid data for creating a Pet instance.
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

  // Test case: Verifies that a pet can be created and saved successfully with all valid data.
  it('should create and save a pet successfully with valid data', async () => {
    const validData = createValidPetData();
    const pet = new Pet(validData);
    const savedPet = await pet.save();

    // Assertions to check if the saved pet's properties match the input data.
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
    expect(savedPet.pictures).toEqual([]); // Check default value for pictures
    expect(savedPet.createdAt).toBeDefined();
    expect(savedPet.updatedAt).toBeDefined();
  });

  // Test case: Verifies that whitespace is trimmed from 'name' and 'medicalInfo' fields.
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

  // Dynamically create test cases to verify that all specified required fields are enforced.
  const requiredFields = ['name', 'ageYears', 'ageMonths', 'weight', 'species', 'gender', 'breed', 'owner'];
  requiredFields.forEach((field) => {
    it(`should fail to save if required field "${field}" is missing`, async () => {
      const invalidData = createValidPetData();
      delete invalidData[field]; // Remove the current required field
      const pet = new Pet(invalidData);

      // Expect the save operation to throw a Mongoose ValidationError.
      await expect(pet.save()).rejects.toThrow(mongoose.Error.ValidationError);

      // Optionally, verify that the error object specifically mentions the missing field.
      try {
        await pet.save();
      } catch (error) {
        expect(error.errors[field]).toBeDefined();
      }
    });
  });

  // Test cases for enum validation on 'species' and 'gender' fields.
  it('should fail to save with invalid species', async () => {
    const invalidData = { ...createValidPetData(), species: 'Bird' }; // 'Bird' is not in the enum
    const pet = new Pet(invalidData);
    await expect(pet.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await pet.save(); } catch (error) { expect(error.errors.species).toBeDefined(); }
  });

  it('should fail to save with invalid gender', async () => {
    const invalidData = { ...createValidPetData(), gender: 'Unknown' }; // 'Unknown' is not in the enum
    const pet = new Pet(invalidData);
    await expect(pet.save()).rejects.toThrow(mongoose.Error.ValidationError);
    try { await pet.save(); } catch (error) { expect(error.errors.gender).toBeDefined(); }
  });

  // Test cases for numeric constraints (min/max values).
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

