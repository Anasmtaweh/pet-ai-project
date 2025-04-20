import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './EditPet.module.css'; // Assuming you have EditPet.module.css similar to PetForm
import { FaCat, FaDog } from 'react-icons/fa';

function EditPet() {
    useEffect(() => {
        document.title = "MISHTIKA - Edit Pet";
    }, []);
    const [name, setName] = useState('');
    const [ageYears, setAgeYears] = useState('');
    const [ageMonths, setAgeMonths] = useState('');
    const [weight, setWeight] = useState('');
    const [species, setSpecies] = useState('');
    const [breed, setBreed] = useState('');
    const [medicalInfo, setMedicalInfo] = useState('');
    // const [pictures, setPictures] = useState([]); // Picture updates are complex, often handled separately
    const [gender, setGender] = useState(''); // Added gender state
    const [error, setError] = useState('');
    const [isOtherBreed, setIsOtherBreed] = useState(false);
    const [initialBreed, setInitialBreed] = useState(''); // Store initial breed for 'Other' logic
    const navigate = useNavigate();
    const { petId } = useParams();
    const token = localStorage.getItem('token'); // Get token early

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

    useEffect(() => {
        const fetchPet = async () => {
            if (!petId || !token) return; // Don't fetch without ID or token
            try {
                const response = await axios.get(`https://mishtika.duckdns.org/pets/${petId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const petData = response.data;
                setName(petData.name || '');
                setAgeYears(petData.ageYears !== undefined ? petData.ageYears : '');
                setAgeMonths(petData.ageMonths !== undefined ? petData.ageMonths : '');
                setWeight(petData.weight !== undefined ? petData.weight : '');
                setSpecies(petData.species || '');
                setGender(petData.gender || ''); // Set gender state
                setBreed(petData.breed || '');
                setInitialBreed(petData.breed || ''); // Store initial breed
                setMedicalInfo(petData.medicalInfo || '');
                // setPictures(petData.pictures || []); // Pictures usually not re-fetched/edited this way

                // Determine if breed is 'other' based on fetched data
                const knownBreeds = petData.species === 'Dog' ? dogBreeds : catBreeds;
                // Check if the fetched breed is NOT in the known list (excluding the 'Other' option itself)
                setIsOtherBreed(petData.breed && !knownBreeds.slice(0, -1).includes(petData.breed));

            } catch (error) {
                console.error('Error fetching pet:', error);
                setError('Error fetching pet data. Please try again.');
            }
        };

        fetchPet();
    }, [petId, token]); // Add token dependency

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
        if (isOtherBreed && breed.trim() === '') { // Ensure 'Other' text field is filled
             setError('Please specify the breed.'); return;
        }
        // --- End Validations ---

        try {
            const petData = {
                name,
                ageYears: Number(ageYears),
                ageMonths: Number(ageMonths),
                weight: Number(weight),
                species,
                gender, // Include gender
                breed, // Send the current value (could be from dropdown or text input)
                medicalInfo,
                // Pictures are usually handled via separate upload endpoints on edit
            };

            await axios.put(`https://mishtika.duckdns.org/pets/${petId}`, petData, {
                headers: { Authorization: `Bearer ${token}` },
            });

            console.log('Pet updated successfully');
            navigate('/petprofile');
        } catch (err) {
            console.error('Error updating pet:', err.response?.data || err.message);
            let errorMsg = 'An error occurred while updating the pet.';
            if (err.response?.data?.message) {
                errorMsg = err.response.data.message;
            } else if (err.response?.data?.details) {
                const details = err.response.data.details;
                errorMsg = Object.values(details).map(detail => detail.message).join(' ');
            }
            setError(errorMsg);
        }
    };

    // --- Handlers ---
    const handleSpeciesClick = (selectedSpecies) => {
        if (species !== selectedSpecies) { // Only reset if species actually changes
            setSpecies(selectedSpecies);
            setBreed(''); // Reset breed
            setIsOtherBreed(false);
            setInitialBreed('');
        }
    };
    const handleBreedChange = (e) => {
        const selectedBreed = e.target.value;
        setBreed(selectedBreed);
        setIsOtherBreed(selectedBreed === 'Other');
        if (selectedBreed !== 'Other') {
             setInitialBreed(selectedBreed); // Update initial if selecting from dropdown
        } else {
             setBreed(''); // Clear breed state if 'Other' is selected, ready for text input
        }
    };
     const handleOtherBreedChange = (e) => {
        setBreed(e.target.value); // Update breed state directly
    };
    const handleGenderChange = (e) => { setGender(e.target.value); };
    // --- End Handlers ---

    return (
        <Container className={`${styles.editPetContainer} mt-5`}>
            <h1 className={styles.editPetTitle}>Edit Pet</h1>
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
                    <Form.Control className={styles.formControl} type="number" value={ageYears} onChange={(e) => setAgeYears(e.target.value)} required min="0" />
                </Form.Group>
                {/* Age Months */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Age (Months)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" value={ageMonths} onChange={(e) => setAgeMonths(e.target.value)} required min="0" max="11" />
                </Form.Group>
                {/* Weight */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Weight (kg)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required min="0.1" />
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
                            id="genderMaleEdit"
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
                            id="genderFemaleEdit"
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
                            // If initial breed wasn't 'Other', use it, otherwise use current breed state
                            value={!isOtherBreed && dogBreeds.includes(initialBreed) ? initialBreed : (isOtherBreed ? 'Other' : breed)}
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
                            value={!isOtherBreed && catBreeds.includes(initialBreed) ? initialBreed : (isOtherBreed ? 'Other' : breed)}
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
                            // If 'Other' was selected, show current breed state, otherwise show initial breed
                            value={breed === 'Other' ? '' : breed}
                            onChange={handleOtherBreedChange}
                            required
                        />
                    </Form.Group>
                )}

                {/* Medical Info */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Medical Information (Optional)</Form.Label>
                    <Form.Control className={styles.formControl} as="textarea" rows={3} value={medicalInfo} onChange={(e) => setMedicalInfo(e.target.value)} />
                </Form.Group>

                {/* Pictures - Usually handled separately on edit */}
                {/* <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Update Pictures (Optional)</Form.Label>
                    <Form.Control className={styles.formControl} type="file" multiple onChange={(e) => setPictures(e.target.files)} accept="image/*" />
                </Form.Group> */}

                <Button className={styles.editPetButton} variant="primary" type="submit">
                    Save Changes
                </Button>
            </Form>
        </Container>
    );
}

export default EditPet;

