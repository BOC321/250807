// Consent form component
import { ConsentFormProps } from '../../types/ui';

export const ConsentForm = ({ onConsent }: ConsentFormProps) => {
  return (
    <div className="consent-form">
      <h2>Survey Consent</h2>
      <div className="consent-content">
        <p>
          Before you begin this survey, please read and agree to the following terms:
        </p>
        <ul>
          <li>All responses are confidential and will be used only for research purposes</li>
          <li>Your personal information will be protected according to our privacy policy</li>
          <li>You may skip any questions you do not wish to answer</li>
          <li>You can withdraw from the survey at any time</li>
          <li>The survey should take approximately 10-15 minutes to complete</li>
        </ul>
        <p>
          By clicking "I Agree" below, you indicate that you are at least 18 years old 
          and consent to participate in this survey.
        </p>
        <div className="consent-buttons">
          <button 
            onClick={() => onConsent(true)}
            className="consent-agree"
          >
            I Agree
          </button>
          <button 
            onClick={() => onConsent(false)}
            className="consent-disagree"
          >
            I Disagree
          </button>
        </div>
      </div>
    </div>
  );
};
