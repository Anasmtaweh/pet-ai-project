import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import { useNavigate } from 'react-router-dom';
import styles from './PetForm.module.css';
import { FaCat, FaDog } from 'react-icons/fa';

// PetForm component for adding a new pet.
function PetForm() {
    // Effect hook to set the document title when the component mounts.
    useEffect(() => {
        document.title = "MISHTIKA - Add Pet";
    }, []);

    // State variables for form inputs.
    const [name, setName] = useState('');
    const [ageYears, setAgeYears] = useState('');
    const [ageMonths, setAgeMonths] = useState('');
    const [weight, setWeight] = useState('');
    const [species, setSpecies] = useState('');
    const [breed, setBreed] = useState(''); // Holds the actual breed name (standard or custom).
    const [medicalInfo, setMedicalInfo] = useState('');
    const [pictureFile, setPictureFile] = useState(null); // State to hold the selected picture file object.
    const [gender, setGender] = useState('');
    const [error, setError] = useState('');
    // State to manage visibility of the 'Other' breed text input.
    const [isOtherBreed, setIsOtherBreed] = useState(false);
    // Hook for programmatic navigation.
    const navigate = useNavigate();

    // Predefined lists of common dog and cat breeds.
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

    // Handler for when a picture file is selected by the user.
    const handlePictureChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setPictureFile(e.target.files[0]); // Store the selected file object.
        } else {
            setPictureFile(null); // Clear if no file is selected.
        }
    };

    // Handler for submitting the new pet form.
    const handleSubmit = async (e) => {
        e.preventDefault(); // Prevents default form submission.
        setError(''); // Clears any previous error messages.

        // Client-side form validation.
        if (!name.trim()) { setError('Pet name is required.'); return; }
        if (isNaN(ageYears) || ageYears < 0) { setError('Invalid age in years (0 or greater).'); return; }
        if (isNaN(ageMonths) || ageMonths < 0 || ageMonths > 11) { setError('Invalid age in months (0-11).'); return; }
        if (isNaN(weight) || weight <= 0) { setError('Invalid weight (must be greater than 0).'); return; }
        if (!gender) { setError('Please select a gender.'); return; }
        if (!species) { setError('Please select a species.'); return; }
        if (!breed) { setError('Please select or enter a breed.'); return; }
        if (isOtherBreed && breed.trim() === '') { // If 'Other' is selected, ensure the custom breed field is filled.
             setError('Please specify the breed.'); return;
        }

        try {
            // Retrieve authentication token and decode it to get the owner's ID.
            const token = localStorage.getItem('token');
            if (!token) {
                setError("Authentication error. Please log in again.");
                return;
            }
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            const owner = decodedToken.id;

            // Create FormData object to handle multipart/form-data (for file upload).
            const formData = new FormData();
            formData.append('name', name);
            formData.append('ageYears', ageYears);
            formData.append('ageMonths', ageMonths);
            formData.append('weight', weight);
            formData.append('species', species);
            formData.append('gender', gender);
            formData.append('breed', breed); // Sends the actual breed name (standard or custom).
            formData.append('medicalInfo', medicalInfo);
            formData.append('owner', owner);

            // Append the picture file to FormData if one was selected.
            if (pictureFile) {
                // The key 'picture' must match the field name expected by the backend (Multer).
                formData.append('picture', pictureFile);
            }

            // API call to the backend to add the new pet.
            // Axios automatically sets 'Content-Type' to 'multipart/form-data' for FormData.
            const response = await axios.post('https://mishtika.duckdns.org/pets/add', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            console.log('Pet added successfully:', response.data);
            navigate('/petprofile'); // Navigate to pet profile page on successful addition.
        } catch (err) {
            console.error('Error adding pet:', err.response?.data || err.message);
            // Handle and display error messages from backend validation or API calls.
            let errorMsg = 'An error occurred while adding the pet.';
            if (err.response?.data?.message) {
                errorMsg = err.response.data.message;
            } else if (err.response?.data?.details) { // For Mongoose validation errors.
                const details = err.response.data.details;
                errorMsg = Object.values(details).map(detail => detail.message).join(' ');
            } else if (err.message) { // For network or other errors.
                errorMsg = err.message;
            }
            setError(errorMsg);
        }
    };

    // Handler for age (years) input change.
    const handleAgeYearsChange = (e) => { setAgeYears(e.target.value); };
    // Handler for age (months) input change.
    const handleAgeMonthsChange = (e) => { setAgeMonths(e.target.value); };
    // Handler for weight input change.
    const handleWeightChange = (e) => { setWeight(e.target.value); };

    // Handler for breed dropdown selection change.
    const handleBreedChange = (e) => {
        const selectedBreed = e.target.value;
        setBreed(selectedBreed); // Set the selected breed from dropdown.
        setIsOtherBreed(selectedBreed === 'Other'); // Show text input if 'Other' is selected.
        if (selectedBreed === 'Other') {
            setBreed(''); // Clear breed state to allow typing in the 'Other' text field.
        }
    };
    // Handler for 'Other' breed text input change.
    const handleOtherBreedChange = (e) => {
        setBreed(e.target.value); // Update breed state with the custom typed breed.
    };
    // Handler for species selection (Cat/Dog icons).
    const handleSpeciesClick = (selectedSpecies) => {
        if (species !== selectedSpecies) { // Only update if species actually changes.
            setSpecies(selectedSpecies);
            setBreed(''); // Reset breed when species changes.
            setIsOtherBreed(false); // Reset 'Other' breed input visibility.
        }
    };
    // Handler for gender radio button selection.
    const handleGenderChange = (e) => { setGender(e.target.value); };

    // Renders the form for adding a new pet.
    return (
        <Container className={`${styles.petFormContainer} mt-5`}>
            <h1 className={styles.petFormTitle}>Add Pet</h1>
            {/* Displays any error messages */}
            {error && <div className="alert alert-danger">{error}</div>}
            <Form onSubmit={handleSubmit}>
                {/* Pet Name Input */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Name</Form.Label>
                    <Form.Control className={styles.formControl} type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </Form.Group>
                {/* Age (Years) Input */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Age (Years)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" value={ageYears} onChange={handleAgeYearsChange} required min="0" />
                </Form.Group>
                {/* Age (Months) Input */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Age (Months)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" value={ageMonths} onChange={handleAgeMonthsChange} required min="0" max="11" />
                </Form.Group>
                {/* Weight Input */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Weight (kg)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" step="0.1" value={weight} onChange={handleWeightChange} required min="0.1" />
                </Form.Group>

                {/* Gender Selection Radio Buttons */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Gender</Form.Label>
                    <div>
                        <Form.Check inline type="radio" label="Male" name="gender" id="genderMale" value="Male" checked={gender === 'Male'} onChange={handleGenderChange} required />
                        <Form.Check inline type="radio" label="Female" name="gender" id="genderFemale" value="Female" checked={gender === 'Female'} onChange={handleGenderChange} required />
                    </div>
                </Form.Group>

                {/* Species Selection with Icons */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Species</Form.Label>
                    <div className={styles.speciesSelection}>
                        <div className={`${styles.speciesOption} ${species === 'Cat' ? styles.selected : ''}`} onClick={() => handleSpeciesClick('Cat')}>
                            <FaCat className={styles.speciesIcon} aria-label="Cat" />
                        </div>
                        <div className={`${styles.speciesOption} ${species === 'Dog' ? styles.selected : ''}`} onClick={() => handleSpeciesClick('Dog')}>
                            <FaDog className={styles.speciesIcon} aria-label="Dog" />
                        </div>
                    </div>
                </Form.Group>

                {/* Breed Selection Dropdown (Conditional based on selected species) */}
                {species === 'Dog' && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Breed</Form.Label>
                        <Form.Select className={styles.formControl} value={isOtherBreed ? 'Other' : breed} onChange={handleBreedChange} required >
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
                        <Form.Select className={styles.formControl} value={isOtherBreed ? 'Other' : breed} onChange={handleBreedChange} required >
                            <option value="">Select Cat Breed...</option>
                            {catBreeds.map((breedName) => (
                                <option key={breedName} value={breedName}>{breedName}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                )}

                {/* 'Other' Breed Text Input (Conditional if 'Other' is selected in dropdown) */}
                {isOtherBreed && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Specify Breed</Form.Label>
                        <Form.Control className={styles.formControl} type="text" placeholder="Enter breed name" value={breed} onChange={handleOtherBreedChange} required />
                    </Form.Group>
                )}

                {/* Medical Information Textarea */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Medical Information (Optional)</Form.Label>
                    <Form.Control className={styles.formControl} as="textarea" rows={3} value={medicalInfo} onChange={(e) => setMedicalInfo(e.target.value)} />
                </Form.Group>

                {/* Picture Upload Input */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Picture (Optional)</Form.Label>
                    <Form.Control className={styles.formControl} type="file" name="picture" onChange={handlePictureChange} accept="image/jpeg, image/png, image/gif, image/webp" />
                </Form.Group>

                {/* Submit Button */}
                <Button className={styles.petFormButton} variant="primary" type="submit">Add Pet</Button>
            </Form>
        </Container>
    );
}

export default PetForm;

