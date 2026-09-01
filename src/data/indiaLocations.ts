/**
 * Indian states, union territories and their cities.
 *
 * Coverage is every state and UT, and within each one the district
 * headquarters plus the towns large enough that a member is likely to name one
 * — a little over a thousand entries. It is deliberately not the full census
 * list of ~8,000 towns: that is megabytes in the bundle to serve a tail almost
 * nobody picks. The pickers built on this are searchable and offer OTHER_CITY,
 * so anywhere missing is one line of typing away rather than a dead end.
 *
 * Names use the current official spelling, with the familiar former name in
 * brackets where the rename is recent enough that people still search for it.
 */

export interface IndianState {
  name: string;
  cities: string[];
}

/** Chosen when a member's town is not listed; the picker then asks for text. */
export const OTHER_CITY = 'Other';

export const INDIAN_STATES: IndianState[] = [
  {
    name: 'Andhra Pradesh',
    cities: ['Adoni', 'Amalapuram', 'Anakapalle', 'Anantapur', 'Bapatla', 'Bhimavaram', 'Chilakaluripet', 'Chirala', 'Chittoor', 'Dharmavaram', 'Eluru', 'Gudivada', 'Gudur', 'Guntakal', 'Guntur', 'Hindupur', 'Kadapa', 'Kakinada', 'Kandukur', 'Kavali', 'Kurnool', 'Machilipatnam', 'Madanapalle', 'Mangalagiri', 'Markapur', 'Nandyal', 'Narasaraopet', 'Nellore', 'Nuzvid', 'Ongole', 'Palakollu', 'Parvathipuram', 'Piduguralla', 'Ponnur', 'Proddatur', 'Punganur', 'Puttur', 'Rajahmundry', 'Rajampet', 'Ramachandrapuram', 'Rayachoti', 'Repalle', 'Salur', 'Samalkot', 'Srikakulam', 'Sullurpeta', 'Tadepalligudem', 'Tadpatri', 'Tanuku', 'Tenali', 'Tirupati', 'Tuni', 'Vijayawada', 'Vinukonda', 'Visakhapatnam', 'Vizianagaram', 'Yemmiganur'],
  },
  {
    name: 'Arunachal Pradesh',
    cities: ['Aalo (Along)', 'Anini', 'Basar', 'Bomdila', 'Changlang', 'Daporijo', 'Dirang', 'Hawai', 'Itanagar', 'Khonsa', 'Koloriang', 'Longding', 'Naharlagun', 'Namsai', 'Pasighat', 'Roing', 'Seppa', 'Tawang', 'Tezu', 'Yingkiong', 'Ziro'],
  },
  {
    name: 'Assam',
    cities: ['Barpeta', 'Bongaigaon', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Diphu', 'Goalpara', 'Golaghat', 'Guwahati', 'Haflong', 'Hailakandi', 'Jorhat', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Mangaldoi', 'Morigaon', 'Nagaon', 'Nalbari', 'North Lakhimpur', 'Silchar', 'Sivasagar', 'Tezpur', 'Tinsukia'],
  },
  {
    name: 'Bihar',
    cities: ['Araria', 'Arrah', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bettiah', 'Bhabua', 'Bhagalpur', 'Biharsharif', 'Buxar', 'Chhapra', 'Darbhanga', 'Dehri', 'Gaya', 'Gopalganj', 'Hajipur', 'Jamui', 'Jehanabad', 'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani', 'Motihari', 'Munger', 'Muzaffarpur', 'Nawada', 'Patna', 'Purnia', 'Saharsa', 'Samastipur', 'Sasaram', 'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul'],
  },
  {
    name: 'Chhattisgarh',
    cities: ['Ambikapur', 'Baikunthpur', 'Balod', 'Baloda Bazar', 'Balrampur', 'Bemetara', 'Bhilai', 'Bijapur', 'Bilaspur', 'Dantewada', 'Dhamtari', 'Durg', 'Gariaband', 'Jagdalpur', 'Janjgir', 'Jashpur', 'Kanker', 'Kawardha', 'Kondagaon', 'Korba', 'Mahasamund', 'Mungeli', 'Narayanpur', 'Raigarh', 'Raipur', 'Rajnandgaon', 'Sukma', 'Surajpur'],
  },
  {
    name: 'Goa',
    cities: ['Bicholim', 'Canacona', 'Cuncolim', 'Curchorem', 'Mapusa', 'Margao', 'Mormugao', 'Panaji', 'Ponda', 'Quepem', 'Sanguem', 'Sanquelim', 'Valpoi', 'Vasco da Gama'],
  },
  {
    name: 'Gujarat',
    cities: ['Ahmedabad', 'Amreli', 'Anand', 'Ankleshwar', 'Bharuch', 'Bhavnagar', 'Bhuj', 'Botad', 'Chhota Udaipur', 'Dahod', 'Deesa', 'Gandhidham', 'Gandhinagar', 'Godhra', 'Himatnagar', 'Jamnagar', 'Junagadh', 'Kalol', 'Khambhat', 'Mehsana', 'Modasa', 'Morbi', 'Nadiad', 'Navsari', 'Palanpur', 'Patan', 'Porbandar', 'Rajkot', 'Rajpipla', 'Surat', 'Surendranagar', 'Vadodara', 'Valsad', 'Vapi', 'Veraval'],
  },
  {
    name: 'Haryana',
    cities: ['Ambala', 'Bahadurgarh', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram', 'Hansi', 'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra', 'Mahendragarh', 'Narnaul', 'Narwana', 'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Thanesar', 'Yamunanagar'],
  },
  {
    name: 'Himachal Pradesh',
    cities: ['Bilaspur', 'Chamba', 'Dalhousie', 'Dharamshala', 'Hamirpur', 'Kangra', 'Kasauli', 'Keylong', 'Kullu', 'Manali', 'Mandi', 'Nahan', 'Palampur', 'Paonta Sahib', 'Rampur', 'Reckong Peo', 'Shimla', 'Solan', 'Sundernagar', 'Una'],
  },
  {
    name: 'Jharkhand',
    cities: ['Bokaro Steel City', 'Chaibasa', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamshedpur', 'Jamtara', 'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Medininagar (Daltonganj)', 'Pakur', 'Phusro', 'Ramgarh', 'Ranchi', 'Sahibganj', 'Saraikela', 'Simdega'],
  },
  {
    name: 'Karnataka',
    cities: ['Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru', 'Bhadravati', 'Bidar', 'Chamarajanagar', 'Chikkaballapur', 'Chikkamagaluru', 'Chitradurga', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri', 'Hospet', 'Hubballi', 'Kalaburagi', 'Karwar', 'Kolar', 'Koppal', 'Madikeri', 'Mandya', 'Mangaluru', 'Mysuru', 'Raichur', 'Ramanagara', 'Ranebennur', 'Shivamogga', 'Sirsi', 'Tumakuru', 'Udupi', 'Vijayapura', 'Yadgir'],
  },
  {
    name: 'Kerala',
    cities: ['Alappuzha', 'Aluva', 'Attingal', 'Chalakudy', 'Changanassery', 'Cherthala', 'Ernakulam', 'Guruvayur', 'Idukki', 'Irinjalakuda', 'Kalpetta', 'Kanhangad', 'Kannur', 'Kasaragod', 'Kayamkulam', 'Kochi', 'Kollam', 'Kothamangalam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Manjeri', 'Nedumangad', 'Neyyattinkara', 'Palakkad', 'Pathanamthitta', 'Payyanur', 'Perinthalmanna', 'Ponnani', 'Punalur', 'Thalassery', 'Thiruvalla', 'Thiruvananthapuram', 'Thodupuzha', 'Thrissur', 'Tirur', 'Vadakara'],
  },
  {
    name: 'Madhya Pradesh',
    cities: ['Ashoknagar', 'Balaghat', 'Barwani', 'Betul', 'Bhind', 'Bhopal', 'Burhanpur', 'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia', 'Dewas', 'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda', 'Indore', 'Itarsi', 'Jabalpur', 'Jhabua', 'Katni', 'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena', 'Narmadapuram (Hoshangabad)', 'Narsinghpur', 'Neemuch', 'Panna', 'Raisen', 'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore', 'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri', 'Sidhi', 'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria', 'Vidisha'],
  },
  {
    name: 'Maharashtra',
    cities: ['Ahmednagar', 'Akola', 'Alibag', 'Amravati', 'Baramati', 'Beed', 'Bhandara', 'Bhiwandi', 'Bhusawal', 'Buldhana', 'Chandrapur', 'Chhatrapati Sambhajinagar (Aurangabad)', 'Dharashiv (Osmanabad)', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Ichalkaranji', 'Jalgaon', 'Jalna', 'Kalyan', 'Kolhapur', 'Latur', 'Malegaon', 'Mira-Bhayandar', 'Mumbai', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Navi Mumbai', 'Palghar', 'Panvel', 'Parbhani', 'Pune', 'Ratnagiri', 'Sangli', 'Satara', 'Shirdi', 'Sindhudurg', 'Solapur', 'Thane', 'Ulhasnagar', 'Vasai-Virar', 'Wardha', 'Washim', 'Yavatmal'],
  },
  {
    name: 'Manipur',
    cities: ['Bishnupur', 'Chandel', 'Churachandpur', 'Imphal', 'Jiribam', 'Kakching', 'Kamjong', 'Kangpokpi', 'Noney', 'Pherzawl', 'Senapati', 'Tamenglong', 'Tengnoupal', 'Thoubal', 'Ukhrul'],
  },
  {
    name: 'Meghalaya',
    cities: ['Ampati', 'Baghmara', 'Jowai', 'Khliehriat', 'Mairang', 'Mawkyrwat', 'Nongpoh', 'Nongstoin', 'Resubelpara', 'Shillong', 'Tura', 'Williamnagar'],
  },
  {
    name: 'Mizoram',
    cities: ['Aizawl', 'Champhai', 'Hnahthial', 'Khawzawl', 'Kolasib', 'Lawngtlai', 'Lunglei', 'Mamit', 'Saiha', 'Saitual', 'Serchhip'],
  },
  {
    name: 'Nagaland',
    cities: ['Chumukedima', 'Dimapur', 'Kiphire', 'Kohima', 'Longleng', 'Mokokchung', 'Mon', 'Peren', 'Phek', 'Tuensang', 'Wokha', 'Zunheboto'],
  },
  {
    name: 'Odisha',
    cities: ['Angul', 'Balangir', 'Balasore', 'Bargarh', 'Baripada', 'Berhampur', 'Bhadrak', 'Bhawanipatna', 'Bhubaneswar', 'Boudh', 'Cuttack', 'Deogarh', 'Dhenkanal', 'Jagatsinghpur', 'Jajpur', 'Jeypore', 'Jharsuguda', 'Kendrapara', 'Kendujhar', 'Khordha', 'Koraput', 'Malkangiri', 'Nabarangpur', 'Nayagarh', 'Nuapada', 'Paradip', 'Phulbani', 'Puri', 'Rayagada', 'Rourkela', 'Sambalpur', 'Subarnapur', 'Sundargarh'],
  },
  {
    name: 'Punjab',
    cities: ['Abohar', 'Amritsar', 'Barnala', 'Batala', 'Bathinda', 'Faridkot', 'Fazilka', 'Firozpur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Khanna', 'Ludhiana', 'Malerkotla', 'Mansa', 'Moga', 'Mohali', 'Muktsar', 'Nabha', 'Nangal', 'Pathankot', 'Patiala', 'Phagwara', 'Rajpura', 'Rupnagar (Ropar)', 'Sangrur', 'Tarn Taran', 'Zirakpur'],
  },
  {
    name: 'Rajasthan',
    cities: ['Ajmer', 'Alwar', 'Banswara', 'Baran', 'Barmer', 'Beawar', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa', 'Dholpur', 'Dungarpur', 'Fatehpur', 'Gangapur City', 'Hanumangarh', 'Hindaun', 'Jaipur', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Karauli', 'Kishangarh', 'Kota', 'Makrana', 'Nagaur', 'Nathdwara', 'Pali', 'Phalodi', 'Pratapgarh', 'Rajsamand', 'Sawai Madhopur', 'Sikar', 'Sirohi', 'Sri Ganganagar', 'Sujangarh', 'Tonk', 'Udaipur'],
  },
  {
    name: 'Sikkim',
    cities: ['Gangtok', 'Gyalshing', 'Jorethang', 'Mangan', 'Namchi', 'Pakyong', 'Rangpo', 'Ravangla', 'Singtam', 'Soreng'],
  },
  {
    name: 'Tamil Nadu',
    cities: ['Ambur', 'Arakkonam', 'Ariyalur', 'Aruppukottai', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Gudiyatham', 'Hosur', 'Kanchipuram', 'Karaikudi', 'Karur', 'Komarapalayam', 'Krishnagiri', 'Kumbakonam', 'Madurai', 'Mayiladuthurai', 'Mettupalayam', 'Nagapattinam', 'Nagercoil', 'Namakkal', 'Neyveli', 'Palani', 'Pallavaram', 'Perambalur', 'Pollachi', 'Pudukkottai', 'Rajapalayam', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivagangai', 'Sivakasi', 'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Udhagamandalam (Ooty)', 'Vaniyambadi', 'Vellore', 'Villupuram', 'Virudhunagar'],
  },
  {
    name: 'Telangana',
    cities: ['Adilabad', 'Armoor', 'Bhadrachalam', 'Bhainsa', 'Bhongir', 'Bodhan', 'Gadwal', 'Hyderabad', 'Jagtial', 'Jangaon', 'Kagaznagar', 'Kamareddy', 'Karimnagar', 'Khammam', 'Kodad', 'Kothagudem', 'Mahbubnagar', 'Mancherial', 'Medak', 'Miryalaguda', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Palwancha', 'Peddapalli', 'Ramagundam', 'Sangareddy', 'Siddipet', 'Sircilla', 'Suryapet', 'Tandur', 'Vikarabad', 'Wanaparthy', 'Warangal', 'Zaheerabad'],
  },
  {
    name: 'Tripura',
    cities: ['Agartala', 'Ambassa', 'Belonia', 'Dharmanagar', 'Kailashahar', 'Khowai', 'Melaghar', 'Sabroom', 'Sonamura', 'Teliamura', 'Udaipur'],
  },
  {
    name: 'Uttar Pradesh',
    cities: ['Agra', 'Aligarh', 'Amroha', 'Auraiya', 'Ayodhya', 'Azamgarh', 'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Bareilly', 'Basti', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandausi', 'Chitrakoot', 'Deoria', 'Etah', 'Etawah', 'Faizabad', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Ghaziabad', 'Ghazipur', 'Gonda', 'Gorakhpur', 'Hapur', 'Hardoi', 'Hathras', 'Jaunpur', 'Jhansi', 'Kanpur', 'Kasganj', 'Khurja', 'Lakhimpur Kheri', 'Lalitpur', 'Lucknow', 'Maharajganj', 'Mainpuri', 'Mathura', 'Mau', 'Meerut', 'Mirzapur', 'Modinagar', 'Moradabad', 'Muzaffarnagar', 'Noida', 'Orai', 'Pilibhit', 'Pratapgarh', 'Prayagraj (Allahabad)', 'Raebareli', 'Rampur', 'Saharanpur', 'Sambhal', 'Shahjahanpur', 'Shamli', 'Shikohabad', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi'],
  },
  {
    name: 'Uttarakhand',
    cities: ['Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haldwani', 'Haridwar', 'Kashipur', 'Kotdwar', 'Mussoorie', 'Nainital', 'New Tehri', 'Pauri', 'Pithoragarh', 'Rishikesh', 'Roorkee', 'Rudraprayag', 'Rudrapur', 'Srinagar', 'Uttarkashi'],
  },
  {
    name: 'West Bengal',
    cities: ['Alipurduar', 'Asansol', 'Baharampur', 'Balurghat', 'Bankura', 'Barasat', 'Bardhaman', 'Basirhat', 'Bishnupur', 'Bolpur', 'Chandannagar', 'Contai', 'Cooch Behar', 'Darjeeling', 'Diamond Harbour', 'Durgapur', 'Habra', 'Haldia', 'Howrah', 'Jalpaiguri', 'Jhargram', 'Kalimpong', 'Kharagpur', 'Kolkata', 'Krishnanagar', 'Malda', 'Medinipur', 'Nabadwip', 'Purulia', 'Raiganj', 'Rampurhat', 'Ranaghat', 'Siliguri', 'Suri', 'Tamluk'],
  },
  {
    name: 'Andaman and Nicobar Islands',
    cities: ['Car Nicobar', 'Diglipur', 'Havelock Island', 'Mayabunder', 'Port Blair', 'Rangat'],
  },
  {
    name: 'Chandigarh',
    cities: ['Chandigarh'],
  },
  {
    name: 'Dadra and Nagar Haveli and Daman and Diu',
    cities: ['Amli', 'Daman', 'Diu', 'Silvassa'],
  },
  {
    name: 'Delhi',
    cities: ['Central Delhi', 'Delhi Cantonment', 'Dwarka', 'East Delhi', 'Karol Bagh', 'Najafgarh', 'Narela', 'New Delhi', 'North Delhi', 'Pitampura', 'Rohini', 'Saket', 'Shahdara', 'South Delhi', 'Vasant Kunj', 'West Delhi'],
  },
  {
    name: 'Jammu and Kashmir',
    cities: ['Anantnag', 'Awantipora', 'Bandipora', 'Baramulla', 'Budgam', 'Doda', 'Ganderbal', 'Handwara', 'Jammu', 'Kathua', 'Kishtwar', 'Kulgam', 'Kupwara', 'Poonch', 'Pulwama', 'Rajouri', 'Ramban', 'Reasi', 'Samba', 'Shopian', 'Sopore', 'Srinagar', 'Udhampur'],
  },
  {
    name: 'Ladakh',
    cities: ['Diskit', 'Kargil', 'Leh', 'Nubra', 'Zanskar'],
  },
  {
    name: 'Lakshadweep',
    cities: ['Agatti', 'Amini', 'Andrott', 'Kadmat', 'Kavaratti', 'Minicoy'],
  },
  {
    name: 'Puducherry',
    cities: ['Karaikal', 'Mahe', 'Puducherry', 'Villianur', 'Yanam'],
  },
];

/** State and UT names, in the order above — states first, then UTs. */
export const STATE_NAMES: string[] = INDIAN_STATES.map(s => s.name);

/** Cities in a state, or an empty list when the state is unknown or unset. */
export const citiesForState = (state?: string | null): string[] =>
  INDIAN_STATES.find(s => s.name === state)?.cities ?? [];

/** True when a stored city came from free text rather than the state's list. */
export const isCustomCity = (state: string, city: string) =>
  !!city.trim() && !citiesForState(state).includes(city.trim());
