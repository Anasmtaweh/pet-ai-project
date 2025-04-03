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
    const [pictures, setPictures] = useState([]);
    const [error, setError] = useState('');
    const [isOtherBreed, setIsOtherBreed] = useState(false);
    const navigate = useNavigate();

    const dogBreeds = [
        "Labrador Retriever", "German Shepherd", "Golden Retriever", "French Bulldog",
        "Bulldog", "Poodle", "Beagle", "Rottweiler", "Yorkshire Terrier", "Dachshund",
        "Boxer", "Siberian Husky", "Shih Tzu", "Great Dane", "Doberman Pinscher",
        "Australian Shepherd", "Cavalier King Charles Spaniel", "Pembroke Welsh Corgi",
        "Chihuahua", "Bernese Mountain Dog"
    ];

    const catBreeds = [
        "Persian", "Maine Coon", "Ragdoll", "Siamese", "British Shorthair",
        "Bengal", "Sphynx", "Abyssinian", "Scottish Fold", "Russian Blue",
        "American Shorthair", "Norwegian Forest Cat", "Devon Rex", "Birman",
        "Oriental Shorthair", "Exotic Shorthair", "Tonkinese", "Burmese",
        "Siberian", "Cornish Rex"
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Basic Input Validation
        if (!name.trim()) {
            setError('Pet name is required.');
            return;
        }
        if (isNaN(ageMonths) || ageMonths < 0 || ageMonths > 11) {
            setError('Invalid age in months (0-11).');
            return;
        }
        if (isNaN(ageYears) || ageYears < 0) {
            setError('Invalid age in years (0 or greater).');
            return;
        }
        if (isNaN(weight) || weight < 0) {
            setError('Invalid weight (0 or greater).');
            return;
        }
        if (!species || (species !== 'Dog' && species !== 'Cat')) {
            setError('Please select a species.');
            return;
        }
        if (!breed.trim() && !isOtherBreed) {
            setError('Please select or enter a breed.');
            return;
        }


        try {
            const token = localStorage.getItem('token');
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            const owner = decodedToken.id;

            const petData = {
                name,
                ageYears: Number(ageYears),
                ageMonths: Number(ageMonths),
                weight: Number(weight),
                species,
                breed,
                medicalInfo,
                owner,
                pictures: Array.from(pictures), // Ensure pictures is an array
            };
            const response = await axios.post('http://localhost:3001/pets/add', petData);

            console.log('Pet added successfully:', response.data);
            navigate('/petprofile');
        } catch (err) {
            console.error('Error adding pet:', err.response?.data || err.message);
            setError(err.response?.data?.message || 'An error occurred');
        }
    };
    const handleAgeYearsChange = (e) => {
        setAgeYears(e.target.value);
    };
    const handleAgeMonthsChange = (e) => {
        setAgeMonths(e.target.value);
    };
    const handleWeightChange = (e) => {
        setWeight(e.target.value);
    };
    const handleBreedChange = (e) => {
        setBreed(e.target.value);
        setIsOtherBreed(e.target.value === 'other');
    };
    const handleSpeciesClick = (selectedSpecies) => {
        setSpecies(selectedSpecies);
    };

    return (
        <Container className={`${styles.petFormContainer} mt-5`}>
            <h1 className={styles.petFormTitle}>Add Pet</h1>
            {error && <div className="alert alert-danger">{error}</div>}
            <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Name</Form.Label>
                    <Form.Control className={styles.formControl} type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Age (Years)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" value={ageYears} onChange={handleAgeYearsChange} required min="0" />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Age (Months)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" value={ageMonths} onChange={handleAgeMonthsChange} required min="0" max="11" />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Weight (kg)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" value={weight} onChange={handleWeightChange} required min="0" />
                </Form.Group>
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
                {species === 'Dog' && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Breed</Form.Label>
                        <Form.Select className={styles.formControl} value={breed} onChange={handleBreedChange} required={!isOtherBreed}>
                            <option value="">Select...</option>
                            {dogBreeds.map((breedName) => (
                                <option key={breedName} value={breedName}>{breedName}</option>
                            ))}
                            <option value="other">Other (Please Specify)</option>
                        </Form.Select>
                    </Form.Group>
                )}
                {species === 'Cat' && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Breed</Form.Label>
                        <Form.Select className={styles.formControl} value={breed} onChange={handleBreedChange} required={!isOtherBreed}>
                            <option value="">Select...</option>
                            {catBreeds.map((breedName) => (
                                <option key={breedName} value={breedName}>{breedName}</option>
                            ))}
                            <option value="other">Other (Please Specify)</option>
                        </Form.Select>
                    </Form.Group>
                )}
                {(species === 'Dog' || species === 'Cat') && isOtherBreed && (
                    <Form.Group className="mb-3">
                        <Form.Control className={styles.formControl} type="text" placeholder="Enter Breed" value={breed} onChange={(e) => setBreed(e.target.value)} required />
                    </Form.Group>
                )}
                {species !== 'Dog' && species !== 'Cat' && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Breed</Form.Label>
                        <Form.Control className={styles.formControl} type="text" value={breed} onChange={(e) => setBreed(e.target.value)} required />
                    </Form.Group>
                )}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Medical Information</Form.Label>
                    <Form.Control className={styles.formControl} as="textarea" value={medicalInfo} onChange={(e) => setMedicalInfo(e.target.value)} />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Pictures (Optional)</Form.Label>
                    <Form.Control className={styles.formControl} type="file" multiple onChange={(e) => setPictures(Array.from(e.target.files))} />
                </Form.Group>
                <Button className={styles.petFormButton} variant="primary" type="submit">Add Pet</Button>
            </Form>
        </Container>
    );
}

export default PetForm;
