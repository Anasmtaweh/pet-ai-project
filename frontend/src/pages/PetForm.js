// c:\Users\Anas\M5\pet-ai-project\frontend\src\pages\PetForm.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import { useNavigate } from 'react-router-dom';
import styles from './PetForm.module.css';
import { FaCat, FaDog } from 'react-icons/fa';

function PetForm() {
    useEffect(() => {
        document.title = "MISHTIKA - Add Pet";
    }, []);
    const [name, setName] = useState('');
    const [ageYears, setAgeYears] = useState('');
    const [ageMonths, setAgeMonths] = useState('');
    const [weight, setWeight] = useState('');
    const [species, setSpecies] = useState('');
    const [breed, setBreed] = useState('');
    const [medicalInfo, setMedicalInfo] = useState('');
    // const [pictures, setPictures] = useState([]); // Removed state for pictures
    const [gender, setGender] = useState('');
    const [error, setError] = useState('');
    const [isOtherBreed, setIsOtherBreed] = useState(false);
    const navigate = useNavigate();

    const dogBreeds = [
        "Labrador Retriever", "German Shepherd", "Golden Retriever", "French Bulldog",
        "Bulldog", "Poodle", "Beagle", "Rottweiler", "Yorkshire Terrier", "Dachshund",
        "Boxer", "Siberian Husky", "Shih Tzu", "Great Dane", "Doberman Pinscher",
        "Australian Shepherd", "Cavalier King Charles Spaniel", "Pembroke Welsh Corgi",
        "Chihuahua", "Bernese Mountain Dog", "Other"
    ];

    const catBreeds = [
        "Persian", "Maine Coon", "Ragdoll", "Siamese", "British Shorthair",
        "Bengal", "Sphynx", "Abyssinian", "Scottish Fold", "Russian Blue",
        "American Shorthair", "Norwegian Forest Cat", "Devon Rex", "Birman",
        "Oriental Shorthair", "Exotic Shorthair", "Tonkinese", "Burmese",
        "Siberian", "Cornish Rex", "Other"
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // --- Validations ---
        if (!name.trim()) { setError('Pet name is required.'); return; }
        if (isNaN(ageYears) || ageYears < 0) { setError('Invalid age in years (0 or greater).'); return; }
        if (isNaN(ageMonths) || ageMonths < 0 || ageMonths > 11) { setError('Invalid age in months (0-11).'); return; }
        if (isNaN(weight) || weight <= 0) { setError('Invalid weight (must be greater than 0).'); return; }
        if (!gender) { setError('Please select a gender.'); return; }
        if (!species) { setError('Please select a species.'); return; }
        if (!breed) { setError('Please select or enter a breed.'); return; }
        if (isOtherBreed && breed.trim() === '') { // Check if 'Other' text field is filled
             setError('Please specify the breed.'); return;
        }
        // --- End Validations ---


        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError("Authentication error. Please log in again.");
                return;
            }
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            const owner = decodedToken.id;

            // --- Create a plain JavaScript object instead of FormData ---
            // This allows the backend's express.json() middleware to parse it.
            // NOTE: File uploads (pictures) are NOT supported with this method.
            const petData = {
                name: name,
                ageYears: Number(ageYears),
                ageMonths: Number(ageMonths),
                weight: Number(weight),
                species: species,
                gender: gender,
                // Use the current breed value (handles 'Other' text input correctly)
                breed: breed,
                medicalInfo: medicalInfo,
                owner: owner,
                // pictures: [] // Cannot send files this way
            };


            // --- Send the plain object (Axios will set Content-Type: application/json) ---
            const response = await axios.post('https://mishtika.duckdns.org/pets/add', petData, { // Send petData object
                headers: {
                    Authorization: `Bearer ${token}`,
                    // 'Content-Type': 'application/json' // Axios usually sets this automatically for objects
                },
            });

            console.log('Pet added successfully:', response.data);
            navigate('/petprofile');
        } catch (err) {
            console.error('Error adding pet:', err.response?.data || err.message);
            // More specific error handling
            let errorMsg = 'An error occurred while adding the pet.';
            if (err.response?.data?.message) {
                errorMsg = err.response.data.message;
            } else if (err.response?.data?.details) {
                // Extract Mongoose validation errors
                const details = err.response.data.details;
                errorMsg = Object.values(details).map(detail => detail.message).join(' ');
            }
            setError(errorMsg);
        }
    };

    // --- Handlers (No changes needed for most, removed picture handler) ---
    const handleAgeYearsChange = (e) => { setAgeYears(e.target.value); };
    const handleAgeMonthsChange = (e) => { setAgeMonths(e.target.value); };
    const handleWeightChange = (e) => { setWeight(e.target.value); };
    const handleBreedChange = (e) => {
        const selectedBreed = e.target.value;
        setBreed(selectedBreed);
        setIsOtherBreed(selectedBreed === 'Other');
        if (selectedBreed === 'Other') {
            setBreed(''); // Clear breed state if 'Other' is selected, ready for text input
        }
    };
    const handleOtherBreedChange = (e) => {
        setBreed(e.target.value); // Update breed state directly when typing in 'Other' field
    };
    const handleSpeciesClick = (selectedSpecies) => {
        if (species !== selectedSpecies) { // Only reset if species changes
            setSpecies(selectedSpecies);
            setBreed(''); // Reset breed when species changes
            setIsOtherBreed(false);
        }
    };
    const handleGenderChange = (e) => { setGender(e.target.value); };
    // const handlePictureChange = (e) => { setPictures(e.target.files); }; // Removed picture handler

    return (
        <Container className={`${styles.petFormContainer} mt-5`}>
            <h1 className={styles.petFormTitle}>Add Pet</h1>
            {error && <div className="alert alert-danger">{error}</div>}
            <Form onSubmit={handleSubmit}>
                {/* Name */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Name</Form.Label>
                    <Form.Control className={styles.formControl} type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </Form.Group>
                {/* Age Years */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Age (Years)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" value={ageYears} onChange={handleAgeYearsChange} required min="0" />
                </Form.Group>
                {/* Age Months */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Age (Months)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" value={ageMonths} onChange={handleAgeMonthsChange} required min="0" max="11" />
                </Form.Group>
                {/* Weight */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Weight (kg)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" step="0.1" value={weight} onChange={handleWeightChange} required min="0.1" />
                </Form.Group>

                {/* Gender Radio Buttons */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Gender</Form.Label>
                    <div>
                        <Form.Check
                            inline
                            type="radio"
                            label="Male"
                            name="gender"
                            id="genderMale"
                            value="Male"
                            checked={gender === 'Male'}
                            onChange={handleGenderChange}
                            required
                        />
                        <Form.Check
                            inline
                            type="radio"
                            label="Female"
                            name="gender"
                            id="genderFemale"
                            value="Female"
                            checked={gender === 'Female'}
                            onChange={handleGenderChange}
                            required
                        />
                    </div>
                </Form.Group>

                {/* Species Selection */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Species</Form.Label>
                    <div className={styles.speciesSelection}>
                        <div
                            className={`${styles.speciesOption} ${species === 'Cat' ? styles.selected : ''}`}
                            onClick={() => handleSpeciesClick('Cat')}
                        >
                            <FaCat className={styles.speciesIcon} aria-label="Cat" />
                        </div>
                        <div
                            className={`${styles.speciesOption} ${species === 'Dog' ? styles.selected : ''}`}
                            onClick={() => handleSpeciesClick('Dog')}
                        >
                            <FaDog className={styles.speciesIcon} aria-label="Dog" />
                        </div>
                    </div>
                </Form.Group>

                {/* Breed Selection (Conditional) */}
                {species === 'Dog' && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Breed</Form.Label>
                        <Form.Select
                            className={styles.formControl}
                            value={isOtherBreed ? 'Other' : breed} // Show 'Other' if it's selected, otherwise the breed
                            onChange={handleBreedChange}
                            required
                        >
                            <option value="">Select Dog Breed...</option>
                            {dogBreeds.map((breedName) => (
                                <option key={breedName} value={breedName}>{breedName}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                )}
                {species === 'Cat' && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Breed</Form.Label>
                        <Form.Select
                            className={styles.formControl}
                            value={isOtherBreed ? 'Other' : breed} // Show 'Other' if it's selected, otherwise the breed
                            onChange={handleBreedChange}
                            required
                        >
                            <option value="">Select Cat Breed...</option>
                            {catBreeds.map((breedName) => (
                                <option key={breedName} value={breedName}>{breedName}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                )}

                {/* Other Breed Text Input (Conditional) */}
                {isOtherBreed && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Specify Breed</Form.Label>
                        <Form.Control
                            className={styles.formControl}
                            type="text"
                            placeholder="Enter breed name"
                            value={breed} // Value is the typed text
                            onChange={handleOtherBreedChange} // Use specific handler
                            required
                        />
                    </Form.Group>
                )}

                {/* Medical Info */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Medical Information (Optional)</Form.Label>
                    <Form.Control className={styles.formControl} as="textarea" rows={3} value={medicalInfo} onChange={(e) => setMedicalInfo(e.target.value)} />
                </Form.Group>

                {/* Pictures Input Removed */}
                {/*
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Pictures (Optional)</Form.Label>
                    <Form.Control className={styles.formControl} type="file" multiple onChange={handlePictureChange} accept="image/*" />
                </Form.Group>
                */}

                <Button className={styles.petFormButton} variant="primary" type="submit">Add Pet</Button>
            </Form>
        </Container>
    );
}

export default PetForm;
