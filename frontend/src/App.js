import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from './authConfig';

// Configure axios base URL and CORS headers
axios.defaults.baseURL = 'http://localhost:5000';
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.withCredentials = false; // Disable credentials for CORS

function App() {
  const { instance, accounts } = useMsal();
  const [tickets, setTickets] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]); // Will be loaded from RPCMaster database
  const [branchSearch, setBranchSearch] = useState('');
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [showEndWorkPopup, setShowEndWorkPopup] = useState(false);
  const [solutionNotes, setSolutionNotes] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState('success'); // 'success' or 'error'
  const [showIssueTypeForm, setShowIssueTypeForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [issueTypeFormData, setIssueTypeFormData] = useState({
    name: '',
    description: ''
  });
  const [userFormData, setUserFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    role: 'user',
    department: '',
    phone: '',
    password: ''
  });
  const [editingIssueType, setEditingIssueType] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [activeMasterDataTab, setActiveMasterDataTab] = useState('issue-types');
  // Static priority list - no need for master data management
  const priorities = [
    { id: 1, name: 'Low', level: 1, color: '#28a745', description: 'Low priority issues' },
    { id: 2, name: 'Medium', level: 2, color: '#ffc107', description: 'Medium priority issues' },
    { id: 3, name: 'High', level: 3, color: '#fd7e14', description: 'High priority issues' },
    { id: 4, name: 'Critical', level: 4, color: '#dc3545', description: 'Critical priority issues' }
  ];
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [editingInDetail, setEditingInDetail] = useState(false);
  const [urlTicketNumber, setUrlTicketNumber] = useState(null);
  const [formData, setFormData] = useState({
    reporterName: '',
    contactNumber: '',
    branch: '',
    issueType: '',
    reportedIssue: '',
    attachments: [],
    dateOfTicket: new Date().toISOString().split('T')[0],
    status: 'Open',
    priority: 'Low',
    assignedTo: '' // Will be set based on user role
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [editingTicket, setEditingTicket] = useState(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    fullName: '',
    email: '',
    role: '',
    department: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showTicketDetail, setShowTicketDetail] = useState(false);
  const [currentPage, setCurrentPage] = useState('main'); // 'main', 'detail', 'master-data', 'profile'
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });

  // State for token-based user lookup
  const [currentToken, setCurrentToken] = useState('');
  const [rpcUsers, setRpcUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsLoggedIn(true);
      // Don't fetch tickets here - wait for user state to be set
      
      // Redirect to /tickets if on root path
      if (window.location.pathname === '/' || window.location.pathname === '') {
        window.history.replaceState({}, '', '/tickets');
      }
    }
  }, []);

  // Add touch gesture handling for sidebar
  useEffect(() => {
    let startY = 0;
    let startTime = 0;
    let startX = 0;

    const handleTouchStart = (e) => {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      startTime = Date.now();
      console.log('Touch start:', startY, startX);
    };

    const handleTouchMove = (e) => {
      // Only prevent scrolling if it's a significant horizontal movement
      const currentX = e.touches[0].clientX;
      const deltaX = Math.abs(currentX - startX);
      if (deltaX > 10) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e) => {
      const endY = e.changedTouches[0].clientY;
      const endTime = Date.now();
      const deltaY = endY - startY;
      const deltaTime = endTime - startTime;

      console.log('Touch end - deltaY:', deltaY, 'deltaTime:', deltaTime, 'sidebarHidden:', sidebarHidden);

      // Check if it's a swipe down gesture (more than 50px down in less than 600ms)
      if (deltaY > 50 && deltaTime < 600) {
        // Swipe down detected - hide sidebar
        if (!sidebarHidden) {
          setSidebarHidden(true);
          console.log('Sidebar hidden by swipe down gesture');
        }
      }
    };

    // Add touch event listeners to the document for all devices
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Cleanup
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [sidebarHidden]);

  // Debug: Log branches state whenever it changes
  useEffect(() => {
    console.log('🔍 Branches state updated:', branches);
    console.log('🔍 Number of branches:', branches.length);
  }, [branches]);

  // Fetch users when not logged in, and tickets/master data when logged in
  useEffect(() => {
    if (isLoggedIn && user) {
      fetchTickets();
      fetchIssueTypes();
      fetchBranches();
      
      // Handle URL routing
      const handleUrlChange = () => {
        const path = window.location.pathname;
        if (path.startsWith('/ticket/')) {
          const ticketNumber = path.split('/ticket/')[1];
          if (ticketNumber) {
            setUrlTicketNumber(ticketNumber);
            setCurrentPage('detail');
            setEditingInDetail(false); // Show read-only view by default
            // Fetch ticket by number
            fetchTicketByNumber(ticketNumber);
          }
        } else if (path === '/create') {
          setCurrentPage('create');
          setShowTicketForm(true);
          setEditingTicket(null);
          setUrlTicketNumber(null);
          setSelectedTicket(null);
          setEditingInDetail(false);
        } else if (path === '/' || path === '' || path === '/tickets') {
          setCurrentPage('main');
          setUrlTicketNumber(null);
          setSelectedTicket(null);
          setEditingInDetail(false);
        } else if (path === '/profile') {
          setCurrentPage('profile');
          setUrlTicketNumber(null);
          setSelectedTicket(null);
          setEditingInDetail(false);
          // Fetch latest user data from database
          fetchUserProfile();
        } else if (path === '/masterdata') {
          setCurrentPage('master-data');
          setUrlTicketNumber(null);
          setSelectedTicket(null);
          setEditingInDetail(false);
          // Fetch master data from database
          fetchMasterData();
          // Fetch users from database
          fetchUsers();
        }
      };
      
      // Initial URL check
      handleUrlChange();
      
      // Listen for URL changes
      window.addEventListener('popstate', handleUrlChange);
      
      return () => {
        window.removeEventListener('popstate', handleUrlChange);
      };
    } else {
      fetchUsers(); // Load users for login form
    }
  }, [isLoggedIn, user]);

  // Debug: Log when selectedTicket changes
  useEffect(() => {
    if (selectedTicket) {
      console.log('Selected ticket changed:', selectedTicket);
    }
  }, [selectedTicket]);

  // Auto-fill reporter name, contact number, and assignedTo when user is logged in and on create page
  useEffect(() => {
    if (currentPage === 'create' && user) {
      // Determine assignedTo based on role
      const defaultAssignedTo = user.role === 'admin' ? user.fullName : 'Admin';
      
      setFormData(prev => ({
        ...prev,
        reporterName: user.fullName || prev.reporterName,
        contactNumber: user.phone || prev.contactNumber,
        assignedTo: defaultAssignedTo
      }));
    }
  }, [currentPage, user]);

  const fetchTickets = async () => {
    try {
      // Include user role and ID in the request for filtering
      const userRole = user?.role || '';
      const userId = user?.fullName || user?.username || '';
      
      const response = await axios.get(`/api/tickets?userRole=${encodeURIComponent(userRole)}&userId=${encodeURIComponent(userId)}`);
      setTickets(response.data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  const fetchTicketByNumber = async (ticketNumber) => {
    try {
      // Include user role and ID in the request for access control
      const userRole = user?.role || '';
      const userId = user?.fullName || user?.username || '';
      
      const response = await axios.get(`/api/tickets/by-number/${ticketNumber}?userRole=${encodeURIComponent(userRole)}&userId=${encodeURIComponent(userId)}`);
      setSelectedTicket(response.data);
    } catch (error) {
      console.error('Error fetching ticket by number:', error);
      if (error.response?.status === 403) {
        alert('You do not have access to view this ticket');
      } else {
      alert('Ticket not found');
      }
      // Navigate back to main page
      window.history.pushState({}, '', '/');
      setCurrentPage('main');
      setUrlTicketNumber(null);
    }
  };

  const fetchIssueTypes = async () => {
    try {
      const response = await axios.get('/api/issue-types');
      console.log('Issue types response:', response.data);
      const data = response.data.data || [];
      console.log('Setting issue types to:', data);
      setIssueTypes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching issue types:', error);
      setIssueTypes([]);
    }
  };



  const handleIssueTypeInputChange = (e) => {
    const { name, value } = e.target;
    setIssueTypeFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleIssueTypeSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingIssueType) {
        await axios.put(`/api/issue-types/${editingIssueType.id}`, issueTypeFormData);
      } else {
        await axios.post('/api/issue-types', issueTypeFormData);
      }
      await fetchIssueTypes();
      setIssueTypeFormData({ name: '', description: '' });
      setEditingIssueType(null);
      setShowIssueTypeForm(false);
    } catch (error) {
      console.error('Error saving issue type:', error);
    }
  };

  const handleEditIssueType = (issueType) => {
    setIssueTypeFormData({
      name: issueType.name,
      description: issueType.description
    });
    setEditingIssueType(issueType);
    setShowIssueTypeForm(true);
  };

  const handleDeleteIssueType = async (id) => {
    if (window.confirm('Are you sure you want to delete this issue type?')) {
      try {
        await axios.delete(`/api/issue-types/${id}`);
        await fetchIssueTypes();
      } catch (error) {
        console.error('Error deleting issue type:', error);
      }
    }
  };

  const handleCancelIssueType = () => {
    setIssueTypeFormData({ name: '', description: '' });
    setEditingIssueType(null);
    setShowIssueTypeForm(false);
  };

  // Branch handlers







  // User handlers
  const handleUserInputChange = (e) => {
    const { name, value } = e.target;
    setUserFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await axios.put(`/api/users/${editingUser.id}`, userFormData);
      } else {
        await axios.post('/api/users', userFormData);
      }
      // Fetch updated users from database
      await fetchUsers();
      setUserFormData({ username: '', fullName: '', email: '', role: 'user', department: '', phone: '', password: '' });
      setEditingUser(null);
      setShowUserForm(false);
      showSuccessModal(editingUser ? 'User updated successfully!' : 'User created successfully!');
    } catch (error) {
      console.error('Error saving user:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save user. Please try again.';
      showErrorModal(errorMessage);
    }
  };

  const handleEditUser = (user) => {
    setUserFormData({
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone || '',
      password: user.password || ''
    });
    setEditingUser(user);
    setShowUserForm(true);
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await axios.delete(`/api/users/${id}`);
        // Fetch updated users from database
        await fetchUsers();
        showSuccessModal('User deleted successfully!');
      } catch (error) {
        console.error('Error deleting user:', error);
        showErrorModal('Failed to delete user. Please try again.');
      }
    }
  };

  const handleCancelUser = () => {
    setUserFormData({ username: '', fullName: '', email: '', role: 'user', department: '', phone: '', password: '' });
    setEditingUser(null);
    setShowUserForm(false);
  };


  const toggleSidebar = () => {
    if (sidebarHidden) {
      setSidebarHidden(false);
      setSidebarCollapsed(false);
    } else if (sidebarCollapsed) {
      setSidebarHidden(true);
    } else {
      setSidebarCollapsed(true);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };



  const showSuccessModal = (message) => {
    setModalMessage(message);
    setModalType('success');
    setShowModal(true);
  };

  const showErrorModal = (message) => {
    setModalMessage(message);
    setModalType('error');
    setShowModal(true);
  };


  const closeModal = () => {
    setShowModal(false);
    setModalMessage('');
    
    // If it's a success modal and we're on the create page, navigate to tickets page
    if (modalType === 'success' && currentPage === 'create') {
      window.location.href = 'http://localhost:3000/tickets';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTicket) {
        // Update existing ticket
        // Include user information for permission checking
        const userRole = user?.role || '';
        const userId = user?.fullName || user?.username || '';
        
        await axios.put(`/api/tickets/${editingTicket.id}?userRole=${encodeURIComponent(userRole)}&userId=${encodeURIComponent(userId)}`, {
          reporterName: formData.reporterName,
          contactNumber: formData.contactNumber,
          branch: formData.branch,
          issueType: formData.issueType,
          reportedIssue: formData.reportedIssue,
          status: formData.status,
          assignedTo: formData.assignedTo
        });
        showSuccessModal('Ticket updated successfully!');
      } else {
        // Create new ticket
        await axios.post('/api/tickets', {
          reporterName: formData.reporterName,
          contactNumber: formData.contactNumber,
          branch: formData.branch,
          issueType: formData.issueType,
          reportedIssue: formData.reportedIssue,
          attachments: JSON.stringify(formData.attachments),
          dateOfTicket: formData.dateOfTicket,
          priority: formData.priority,
          createdBy: user.fullName || user.username || 'System'
        });
        showSuccessModal('Ticket created successfully!');
      }
      
      // Reset form and refresh tickets
      const defaultAssignedTo = user?.role === 'admin' ? user.fullName : 'Admin';
      
      setFormData({
        reporterName: user?.fullName || '',
        contactNumber: user?.phone || '',
        branch: '',
        issueType: '',
        reportedIssue: '',
        attachments: [],
        dateOfTicket: new Date().toISOString().split('T')[0],
        status: 'Open',
        priority: 'Low',
        assignedTo: defaultAssignedTo
      });
      setSelectedFiles([]);
      setEditingTicket(null);
      fetchTickets();
      
      // Navigation will be handled by the modal close function
    } catch (error) {
      console.error('Error saving ticket:', error);
      showErrorModal('Error saving ticket. Please try again.');
    }
  };

  const handleEdit = (ticket) => {
    // Navigate to ticket detail page and enter edit mode
    window.history.pushState({}, '', `/ticket/${ticket.ticketNumber}`);
    setUrlTicketNumber(ticket.ticketNumber);
    setCurrentPage('detail');
    setSelectedTicket(ticket);
    setEditingInDetail(true);
    
    // Populate form data for editing
    setFormData({
      reporterName: ticket.reporterName,
      contactNumber: ticket.contactNumber,
      branch: ticket.branch,
      issueType: ticket.issueType,
      reportedIssue: ticket.reportedIssue,
      dateOfTicket: new Date(ticket.dateOfTicket).toISOString().split('T')[0],
      status: ticket.status,
      priority: ticket.priority,
      assignedTo: ticket.assignedTo
    });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this ticket?')) {
      try {
        await axios.delete(`/api/tickets/${id}`);
        fetchTickets();
      } catch (error) {
        console.error('Error deleting ticket:', error);
      }
    }
  };


  const handleCancelEdit = () => {
    const defaultAssignedTo = user?.role === 'admin' ? user.fullName : 'Admin';
    
    setFormData({
      reporterName: user?.fullName || '',
      contactNumber: user?.phone || '',
      branch: '',
      issueType: '',
      reportedIssue: '',
      attachments: [],
      dateOfTicket: new Date().toISOString().split('T')[0],
      status: 'Open',
      priority: 'Low',
      assignedTo: defaultAssignedTo
    });
    setSelectedFiles([]);
    setEditingTicket(null);
    setShowTicketForm(false);
  };

  const handleOpenTicket = () => {
    // Navigate to /create page
    window.history.pushState({}, '', '/create');
    setCurrentPage('create');
    setShowTicketForm(true);
    setEditingTicket(null);
    
    // Determine assignedTo based on role
    const defaultAssignedTo = user?.role === 'admin' ? user.fullName : 'Admin';
    
    setFormData({
      reporterName: user?.fullName || '',
      contactNumber: user?.phone || '',
      branch: '',
      issueType: '',
      reportedIssue: '',
      attachments: [],
      dateOfTicket: new Date().toISOString().split('T')[0],
      status: 'Open',
      priority: 'Low',
      assignedTo: defaultAssignedTo
    });
    setSelectedFiles([]);
  };

  const handleViewTicket = async (ticket) => {
    try {
      // Update URL to include ticket number
      window.history.pushState({}, '', `/ticket/${ticket.ticketNumber}`);
      setUrlTicketNumber(ticket.ticketNumber);
      
      // Fetch ticket details by ticket number for the most up-to-date information
      const response = await axios.get(`/api/tickets/by-number/${ticket.ticketNumber}`);
      setSelectedTicket(response.data);
      setCurrentPage('detail');
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      // Fallback to the ticket data we already have
      setSelectedTicket(ticket);
      setCurrentPage('detail');
    }
  };

  const handleBackToMain = () => {
    // Update URL to tickets page
    window.history.pushState({}, '', '/tickets');
    setCurrentPage('main');
    setSelectedTicket(null);
    setEditingInDetail(false);
    setUrlTicketNumber(null);
    setEditingTicket(null);
  };

  const handleProfileInputChange = (e) => {
    const { name, value } = e.target;
    setProfileFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const fetchUserProfile = async () => {
    try {
      // Fetch user data from database
      const response = await axios.get(`/api/users/${user.id}`);
      if (response.status === 200) {
        const userData = response.data;
        setUser(prev => ({
          ...prev,
          name: userData.fullName,
          email: userData.email,
          role: userData.role,
          department: userData.department,
          username: userData.username,
          phone: userData.phone || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Don't show error modal here as it might be annoying for users
    }
  };

  const fetchMasterData = async () => {
    try {
      // Fetch all master data from database
      const issueTypesRes = await axios.get('/api/issue-types');
      console.log('Master data issue types response:', issueTypesRes.data);
      const data = issueTypesRes.data.data || [];
      console.log('Setting master data issue types to:', data);
      setIssueTypes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching master data:', error);
      setIssueTypes([]); // Set to empty array on error
      showErrorModal('Failed to load master data. Please try again.');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      console.log('Users response:', response.data);
      const data = response.data.data || response.data || [];
      console.log('Setting users to:', data);
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]); // Set to empty array on error
      showErrorModal('Failed to load users. Please try again.');
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const currentFileCount = selectedFiles.length;
    const remainingSlots = 3 - currentFileCount;
    
    if (files.length > remainingSlots) {
      showErrorModal(`You can only upload ${remainingSlots} more file(s). Maximum is 3 files.`);
      return;
    }
    
    // Process each file
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileData = {
          name: file.name,
          data: e.target.result,
          type: file.type
        };
        
        setSelectedFiles(prev => [...prev, file]);
        setFormData(prev => ({
          ...prev,
          attachments: [...prev.attachments, fileData]
        }));
      };
      reader.readAsDataURL(file);
    });
    
    // Clear input to allow selecting the same file again
    e.target.value = '';
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const fetchBranches = async () => {
    try {
      console.log('🔍 Fetching branches from RPCMaster database...');
      const response = await axios.get('/api/rpc/branches');
      console.log('✅ Branches response:', response.data);
      const data = response.data || [];
      console.log('Setting branches to:', data);
      
      if (Array.isArray(data)) {
        setBranches(data);
        console.log(`✅ Loaded ${data.length} branches from database`);
      } else {
        setBranches([]);
        console.warn('⚠️ Invalid response format');
      }
    } catch (error) {
      console.error('❌ Error fetching branches:', error);
      showErrorModal('Cannot load branches from database. Please check your connection to RPCMaster database.');
      setBranches([]);
    }
  };

  // Fetch users by token from RPC Website database
  const fetchUsersByToken = async (token) => {
    if (!token.trim()) {
      setRpcUsers([]);
      return;
    }

    setLoadingUsers(true);
    try {
      console.log('🔍 Fetching RPC users with token:', token);
      const response = await axios.get(`/api/rpc/users?token=${encodeURIComponent(token)}`);
      console.log('✅ RPC Users response:', response.data);
      const data = response.data || [];
      
      if (Array.isArray(data)) {
        setRpcUsers(data);
        console.log(`✅ Loaded ${data.length} RPC users with token: ${token}`);
      } else {
        setRpcUsers([]);
        console.warn('⚠️ Invalid RPC users response format');
      }
    } catch (error) {
      console.error('❌ Error fetching RPC users:', error);
      setRpcUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Filter branches based on search
  const getFilteredBranches = () => {
    if (!branchSearch.trim()) {
      return branches;
    }
    return branches.filter(branch => 
      branch.name.toLowerCase().includes(branchSearch.toLowerCase()) ||
      (branch.code && branch.code.toLowerCase().includes(branchSearch.toLowerCase()))
    );
  };

  // Handle token input change
  const handleTokenChange = (e) => {
    const token = e.target.value;
    setCurrentToken(token);
    
    // Debounce the API call
    clearTimeout(window.tokenTimeout);
    window.tokenTimeout = setTimeout(() => {
      fetchUsersByToken(token);
    }, 500);
  };


  const handleEditProfile = () => {
    setEditingProfile(true);
    setProfileFormData({
      fullName: user.fullName || '',
      email: user.email || '',
      role: user.role || '',
      department: user.department || '',
      phone: user.phone || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  const handleCancelEditProfile = () => {
    setEditingProfile(false);
    setProfileFormData({
      fullName: '',
      email: '',
      role: '',
      department: '',
      phone: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      // Validate password fields if any are filled
      if (profileFormData.newPassword || profileFormData.confirmPassword) {
        if (profileFormData.newPassword !== profileFormData.confirmPassword) {
          showErrorModal('New passwords do not match!');
          return;
        }
        if (profileFormData.newPassword.length < 6) {
          showErrorModal('New password must be at least 6 characters long!');
          return;
        }
      }

      // Prepare update data
      const updateData = {
        Username: user.username || profileFormData.email.split('@')[0], // Use email prefix as username if no username
        FullName: profileFormData.fullName,
        Email: profileFormData.email,
        Role: profileFormData.role,
        Department: profileFormData.department,
        Phone: profileFormData.phone,
        IsActive: true
      };

      // Make API call to update user profile
      const response = await axios.put(`/api/users/${user.id}`, updateData);
      
      if (response.status === 200) {
        // Update local user state with new data
        setUser(prev => ({
          ...prev,
          name: profileFormData.fullName,
          email: profileFormData.email,
          role: profileFormData.role,
          department: profileFormData.department,
          phone: profileFormData.phone,
          username: updateData.Username
        }));
        
        setEditingProfile(false);
        showSuccessModal('Profile updated successfully!');
        
        // Reset form
        setProfileFormData({
          fullName: '',
          email: '',
          role: '',
          department: '',
          phone: '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      if (error.response?.status === 404) {
        showErrorModal('User not found. Please try logging in again.');
      } else if (error.response?.status === 400) {
        showErrorModal('Invalid data provided. Please check your inputs.');
      } else {
        showErrorModal('Failed to update profile. Please try again.');
      }
    }
  };

  const handleEditInDetail = () => {
    setEditingInDetail(true);
    
    // Load existing attachments
    let existingAttachments = [];
    if (selectedTicket.attachment) {
      try {
        existingAttachments = JSON.parse(selectedTicket.attachment);
      } catch (e) {
        existingAttachments = [];
      }
    }
    
    setFormData({
      reporterName: selectedTicket.reporterName,
      contactNumber: selectedTicket.contactNumber,
      branch: selectedTicket.branch,
      issueType: selectedTicket.issueType,
      reportedIssue: selectedTicket.reportedIssue,
      attachments: Array.isArray(existingAttachments) ? existingAttachments : [],
      dateOfTicket: selectedTicket.dateOfTicket,
      status: selectedTicket.status,
      priority: selectedTicket.priority,
      assignedTo: selectedTicket.assignedTo
    });
    
    // Set selectedFiles based on existing attachments (for display)
    if (Array.isArray(existingAttachments)) {
      setSelectedFiles(existingAttachments.map(att => ({ name: att.name })));
    }
  };

  const handleSaveInDetail = async () => {
    try {
      // Include user information for permission checking
      const userRole = user?.role || '';
      const userId = user?.fullName || user?.username || '';
      
      await axios.put(`/api/tickets/${selectedTicket.id}?userRole=${encodeURIComponent(userRole)}&userId=${encodeURIComponent(userId)}`, {
        reporterName: formData.reporterName,
        contactNumber: formData.contactNumber,
        branch: formData.branch,
        issueType: formData.issueType,
        reportedIssue: formData.reportedIssue,
        attachments: JSON.stringify(formData.attachments),
        dateOfTicket: formData.dateOfTicket,
        status: formData.status,
        priority: formData.priority,
        assignedTo: formData.assignedTo
      });
      
      // Update the selected ticket with new data
      setSelectedTicket({
        ...selectedTicket,
        ...formData,
        attachment: JSON.stringify(formData.attachments)
      });
      
      // Refresh tickets list
      await fetchTickets();
      setEditingInDetail(false);
    } catch (error) {
      console.error('Error updating ticket:', error);
    }
  };

  const handleCancelEditInDetail = () => {
    setEditingInDetail(false);
  };

  const handleStartWork = async () => {
    try {
      const currentDateTime = new Date().toISOString();
      
      // Include user information for permission checking
      const userRole = user?.role || '';
      const userId = user?.fullName || user?.username || '';
      
      await axios.put(`/api/tickets/${selectedTicket.id}?userRole=${encodeURIComponent(userRole)}&userId=${encodeURIComponent(userId)}`, {
        reporterName: selectedTicket.reporterName,
        contactNumber: selectedTicket.contactNumber,
        branch: selectedTicket.branch,
        issueType: selectedTicket.issueType,
        reportedIssue: selectedTicket.reportedIssue,
        dateOfTicket: selectedTicket.dateOfTicket,
        status: "In Progress",
        priority: selectedTicket.priority,
        workStartTime: currentDateTime,
        assignedTo: selectedTicket.assignedTo
      });
      
      // Update the selected ticket with new status
      setSelectedTicket({
        ...selectedTicket,
        status: "In Progress",
        workStartTime: currentDateTime
      });
      
      // Refresh tickets list
      await fetchTickets();
      
      alert(`Work started on ${selectedTicket.ticketNumber} at ${new Date().toLocaleString()}`);
    } catch (error) {
      console.error('Error starting work:', error);
      alert('Error starting work. Please try again.');
    }
  };

  const handleEndWork = async () => {
    if (!solutionNotes.trim()) {
      showErrorModal('Please enter how you fixed the issue before closing the ticket.');
      return;
    }
    
    try {
      const currentDateTime = new Date().toISOString();
      
      // Include user information for permission checking
      const userRole = user?.role || '';
      const userId = user?.fullName || user?.username || '';
      
      // Append solution notes to the reported issue
      const updatedIssue = `${selectedTicket.reportedIssue}\n\n--- SOLUTION ---\n${solutionNotes}`;
      
      await axios.put(`/api/tickets/${selectedTicket.id}?userRole=${encodeURIComponent(userRole)}&userId=${encodeURIComponent(userId)}`, {
        reporterName: selectedTicket.reporterName,
        contactNumber: selectedTicket.contactNumber,
        branch: selectedTicket.branch,
        issueType: selectedTicket.issueType,
        reportedIssue: updatedIssue,
        dateOfTicket: selectedTicket.dateOfTicket,
        status: "Closed",
        priority: selectedTicket.priority,
        workStartTime: selectedTicket.workStartTime,
        workEndTime: currentDateTime,
        assignedTo: selectedTicket.assignedTo
      });
      
      // Update the selected ticket with new status
      setSelectedTicket({
        ...selectedTicket,
        status: "Closed",
        workEndTime: currentDateTime,
        reportedIssue: updatedIssue
      });
      
      // Refresh tickets list
      await fetchTickets();
      
      // Close popup and reset
      setShowEndWorkPopup(false);
      setSolutionNotes('');
      
      showSuccessModal(`Work completed on ${selectedTicket.ticketNumber} at ${new Date().toLocaleString()}`);
    } catch (error) {
      console.error('Error ending work:', error);
      showErrorModal('Error ending work. Please try again.');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      const response = await axios.post('/api/auth/login', loginData);
      const userData = response.data;
      
      setUser(userData);
      setIsLoggedIn(true);
      localStorage.setItem('user', JSON.stringify(userData));
      showSuccessModal(`Welcome, ${userData.fullName}!`);
    } catch (error) {
      console.error('Login failed:', error);
      showErrorModal('Invalid username or password. Please try again.');
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      const loginResponse = await instance.loginPopup(loginRequest);
      console.log('Microsoft login successful:', loginResponse);
      
      // Get user info from Microsoft Graph
      const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${loginResponse.accessToken}`
        }
      });
      const graphData = await graphResponse.json();
      
      // Check if user exists in database, if not create them
      try {
        const checkUserResponse = await axios.get(`/api/users`);
        const existingUser = checkUserResponse.data.find(u => u.email === graphData.mail || u.email === graphData.userPrincipalName);
        
        let userData;
        if (existingUser) {
          userData = existingUser;
        } else {
          // Create new user in database
          const newUserData = {
            username: graphData.userPrincipalName.split('@')[0],
            fullName: graphData.displayName,
            email: graphData.mail || graphData.userPrincipalName,
            role: 'user', // Default role
            department: graphData.department || '',
            phone: graphData.mobilePhone || graphData.businessPhones?.[0] || '',
            password: 'microsoft-sso' // Placeholder for SSO users
          };
          
          const createUserResponse = await axios.post('/api/users', newUserData);
          userData = createUserResponse.data;
        }
        
      setUser(userData);
      setIsLoggedIn(true);
      localStorage.setItem('user', JSON.stringify(userData));
        showSuccessModal(`Welcome, ${userData.fullName}!`);
      } catch (error) {
        console.error('Error syncing user with database:', error);
        showErrorModal('Failed to sync user account. Please contact administrator.');
      }
    } catch (error) {
      console.error('Microsoft login failed:', error);
      if (error.errorCode === 'user_cancelled') {
        showErrorModal('Login cancelled');
    } else {
        showErrorModal('Microsoft login failed. Please try again.');
      }
    }
  };

  const handleLogout = async () => {
    console.log('Logout clicked'); // Debug log
    
    // If user logged in with Microsoft, logout from Microsoft too
    if (accounts.length > 0) {
      try {
        await instance.logoutPopup({
          account: accounts[0]
        });
      } catch (error) {
        console.error('Microsoft logout error:', error);
      }
    }
    
    setUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('user');
    setTickets([]);
  };

  const handleLoginInputChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getStatusClass = (status) => {
    if (!status || typeof status !== 'string' || status.trim() === '') {
      return 'status-badge status-open';
    }
    
    switch (status.toLowerCase()) {
      case 'open':
        return 'status-badge status-open';
      case 'in progress':
        return 'status-badge status-in-progress';
      case 'closed':
        return 'status-badge status-closed';
      default:
        return 'status-badge status-open';
    }
  };

  const getPriorityClass = (priority) => {
    if (!priority || typeof priority !== 'string' || priority.trim() === '') {
      return 'priority-badge priority-low';
    }
    
    switch (priority.toLowerCase()) {
      case 'low':
        return 'priority-badge priority-low';
      case 'medium':
        return 'priority-badge priority-medium';
      case 'high':
        return 'priority-badge priority-high';
      case 'critical':
        return 'priority-badge priority-critical';
      default:
        return 'priority-badge priority-low';
    }
  };

  const getPriorityInfo = (priorityName) => {
    return priorities.find(p => p.name.toLowerCase() === priorityName.toLowerCase()) || priorities[0];
  };

  // Show login page if not logged in
  if (!isLoggedIn) {
    return (
      <div className="App" data-grm-disable="true">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <div className="login-logo-container">
                <img src="/Picture.png" alt="Logo" className="login-logo" />
              </div>
              <h1>IT Ticket System</h1>
              <p>Please login to continue</p>
            </div>
            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label htmlFor="username">Username:</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={loginData.username}
                  onChange={handleLoginInputChange}
                  required
                  placeholder="Enter username"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">Password:</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={loginData.password}
                  onChange={handleLoginInputChange}
                  required
                  placeholder="Enter password"
                />
              </div>
              
              
              <button type="submit" className="btn btn-primary btn-large">
                Login
              </button>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                margin: '30px 0',
                textAlign: 'center'
              }}>
                <div style={{ flex: 1, height: '1px', background: '#cbd5e1' }}></div>
                <span style={{ 
                  padding: '0 20px', 
                  color: '#64748b', 
                  fontWeight: '500',
                  fontSize: '0.95rem'
                }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: '#cbd5e1' }}></div>
                </div>
              
                <button 
                type="button"
                onClick={handleMicrosoftLogin}
                className="btn btn-microsoft"
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  background: 'white',
                  color: '#5e5e5e',
                  border: '2px solid #8c8c8c',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f3f3f3';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'white';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
                Sign in with Microsoft
                </button>
            </form>
            
              </div>
            </div>
          </div>
    );
  }

  // Render detail page
  if (currentPage === 'detail' && selectedTicket) {
    return (
      <div className="App" data-grm-disable="true">
        <div className="container" style={{ maxWidth: '1800px', padding: '40px 30px' }}>
          <div className="detail-page">
            <div className="page-header">
              <h2>Ticket Details - {selectedTicket.ticketNumber}</h2>
              <button className="btn btn-secondary" onClick={handleBackToMain}>
                ← Back to Tickets
              </button>
            </div>

            <div className="detail-content">
              {editingInDetail ? (
                // Edit Form
                <form onSubmit={(e) => { e.preventDefault(); handleSaveInDetail(); }}>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Date of Ticket:</label>
                      <input
                        type="date"
                        name="dateOfTicket"
                        value={formData.dateOfTicket}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="detail-item">
                      <label>Ticket Number:</label>
                      <input
                        type="text"
                        value={selectedTicket.ticketNumber}
                        disabled
                        className="disabled-input"
                      />
                    </div>
                    <div className="detail-item">
                      <label>Reporter Name:</label>
                      <input
                        type="text"
                        name="reporterName"
                        value={formData.reporterName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="detail-item">
                      <label>Contact Number:</label>
                      <input
                        type="text"
                        name="contactNumber"
                        value={formData.contactNumber}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="detail-item">
                      <label>Branch:</label>
                      <input
                        type="text"
                        placeholder="🔍 Search..."
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}
                      />
                      <select
                        name="branch"
                        value={formData.branch}
                        onChange={(e) => {
                          handleInputChange(e);
                          setBranchSearch('');
                        }}
                        required
                        size={branchSearch ? Math.min(8, getFilteredBranches().length + 1) : 1}
                      >
                        <option value="">-- Select a branch --</option>
                        {getFilteredBranches().map((branch) => (
                          <option key={branch.id} value={branch.name}>
                            {branch.name} {branch.code ? `(${branch.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="detail-item">
                      <label>Issue Type:</label>
                      <select
                        name="issueType"
                        value={formData.issueType}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select Issue Type</option>
                        {(issueTypes || []).map(issueType => (
                          <option key={issueType.id} value={issueType.name}>
                            {issueType.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="detail-item full-width">
                      <label>Reported Issue:</label>
                      <textarea
                        name="reportedIssue"
                        value={formData.reportedIssue}
                        onChange={handleInputChange}
                        required
                        rows="3"
                      />
                    </div>
                    <div className="detail-item">
                      <label>Status:</label>
                      <input
                        type="text"
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        placeholder="Enter status (e.g., Open, In Progress, Resolved)"
                        required
                      />
                    </div>
                    <div className="detail-item">
                      <label>Priority:</label>
                      <select
                        name="priority"
                        value={formData.priority}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select Priority</option>
                        {priorities.map(priority => (
                          <option key={priority.id} value={priority.name}>
                            {priority.level} - {priority.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="detail-item">
                      <label>Assigned To:</label>
                      <select
                        name="assignedTo"
                        value={formData.assignedTo}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select User</option>
                        {(users || []).map(user => (
                          <option key={user.id} value={user.fullName}>
                            {user.fullName} ({user.role})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="detail-item full-width">
                      <label>Attachments (Max 3):</label>
                      <div className="file-upload-container">
                        {selectedFiles.length < 3 && (
                          <>
                            <input
                              type="file"
                              id="attachmentEdit"
                              onChange={handleFileChange}
                              accept="image/*,.pdf,.doc,.docx,.txt"
                              className="file-input"
                              multiple
                            />
                            <label htmlFor="attachmentEdit" className="file-input-label">
                              <span className="file-input-icon">📎</span>
                              Add File ({selectedFiles.length}/3)
                            </label>
                          </>
                        )}
                        {selectedFiles.length >= 3 && (
                          <div style={{ color: '#16a34a', fontWeight: '500', padding: '0.5rem' }}>
                            ✓ Maximum files reached (3/3)
                          </div>
                        )}
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="file-preview">
                            <span className="file-name">{file.name}</span>
                            <button 
                              type="button" 
                              className="remove-file-btn"
                              onClick={() => handleRemoveFile(index)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </form>
              ) : (
                // Read-only View
                <div className="detail-grid">
                  {user.role === 'admin' ? (
                    // Admin sees all fields
                    <>
                      <div className="detail-item">
                        <label>Date of Ticket:</label>
                        <span>{new Date(selectedTicket.dateOfTicket).toLocaleDateString()}</span>
                      </div>
                      <div className="detail-item">
                        <label>Ticket Number:</label>
                        <span>{selectedTicket.ticketNumber}</span>
                      </div>
                      <div className="detail-item">
                        <label>Reporter Name:</label>
                        <span>{selectedTicket.reporterName}</span>
                      </div>
                      <div className="detail-item">
                        <label>Contact Number:</label>
                        <span>{selectedTicket.contactNumber}</span>
                      </div>
                      <div className="detail-item">
                        <label>Branch:</label>
                        <span>{selectedTicket.branch}</span>
                      </div>
                      <div className="detail-item">
                        <label>Issue Type:</label>
                        <span>{selectedTicket.issueType}</span>
                      </div>
                      <div className="detail-item full-width">
                        <label>Reported Issue:</label>
                        <span style={{ whiteSpace: 'pre-wrap' }}>
                          {selectedTicket.reportedIssue && selectedTicket.reportedIssue.includes('--- SOLUTION ---') 
                            ? selectedTicket.reportedIssue.split('--- SOLUTION ---')[0].trim()
                            : selectedTicket.reportedIssue}
                        </span>
                      </div>
                      {selectedTicket.reportedIssue && selectedTicket.reportedIssue.includes('--- SOLUTION ---') && (
                        <div className="detail-item full-width" style={{
                          background: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
                          padding: '1.5rem',
                          borderRadius: '12px',
                          border: '2px solid #4ade80',
                          marginTop: '1rem'
                        }}>
                          <label style={{ 
                            fontSize: '1.1rem', 
                            fontWeight: '700', 
                            color: '#15803d',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '1rem'
                          }}>
                            <span style={{ fontSize: '1.5rem' }}>✅</span> Solution / Resolution
                          </label>
                          <div style={{ 
                            background: 'white',
                            padding: '1.25rem',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.6',
                            color: '#1f2937',
                            fontSize: '1rem'
                          }}>
                            {selectedTicket.reportedIssue.split('--- SOLUTION ---')[1].trim()}
                      </div>
                        </div>
                      )}
                      <div className="detail-item">
                        <label>Status:</label>
                        <span className={getStatusClass(selectedTicket.status)}>
                          {selectedTicket.status || 'Open'}
                        </span>
                      </div>
                      {selectedTicket.workStartTime && (
                        <div className="detail-item">
                          <label>Work Started:</label>
                          <span className="work-start-time">
                            {new Date(selectedTicket.workStartTime).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {selectedTicket.workEndTime && (
                        <div className="detail-item">
                          <label>Work Completed:</label>
                          <span className="work-end-time">
                            {new Date(selectedTicket.workEndTime).toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="detail-item">
                        <label>Priority:</label>
                        <span 
                          className={getPriorityClass(selectedTicket.priority)}
                          style={{ backgroundColor: getPriorityInfo(selectedTicket.priority).color }}
                        >
                          {getPriorityInfo(selectedTicket.priority).level} - {selectedTicket.priority || 'Low'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <label>Assigned To:</label>
                        <span>{selectedTicket.assignedTo}</span>
                      </div>
                      {selectedTicket.attachment && (() => {
                        try {
                          const attachments = JSON.parse(selectedTicket.attachment);
                          if (Array.isArray(attachments) && attachments.length > 0) {
                            return (
                              <div className="detail-item full-width">
                                <label style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem', display: 'block' }}>
                                  📎 Attachments ({attachments.length}/3)
                                </label>
                                <div style={{ 
                                  display: 'grid', 
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                  gap: '1.5rem'
                                }}>
                                  {attachments.map((att, index) => (
                                    <div key={index} style={{ 
                                      padding: '1.25rem', 
                                      border: '2px solid #e0e7ff', 
                                      borderRadius: '12px',
                                      backgroundColor: '#ffffff',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                      transition: 'all 0.3s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'translateY(-4px)';
                                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
                                      e.currentTarget.style.borderColor = '#818cf8';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                      e.currentTarget.style.borderColor = '#e0e7ff';
                                    }}>
                                      <div style={{ 
                                        fontWeight: '600', 
                                        marginBottom: '1rem', 
                                        color: '#4338ca',
                                        fontSize: '0.95rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {att.name}
                                      </div>
                                      {att.data && att.data.startsWith('data:image') ? (
                                        <div>
                                          <div 
                                            onClick={() => setEnlargedImage(att.data)}
                                            style={{ 
                                              cursor: 'pointer',
                                              position: 'relative',
                                              overflow: 'hidden',
                                              borderRadius: '8px',
                                              backgroundColor: '#f3f4f6',
                                              marginBottom: '1rem'
                                            }}
                                          >
                                            <img 
                                              src={att.data} 
                                              alt={att.name} 
                                              style={{ 
                                                width: '100%', 
                                                height: '200px',
                                                objectFit: 'cover',
                                                borderRadius: '8px',
                                                transition: 'transform 0.3s ease'
                                              }}
                                              onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                                              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                            />
                                            <div style={{
                                              position: 'absolute',
                                              bottom: '8px',
                                              right: '8px',
                                              background: 'rgba(0,0,0,0.75)',
                                              color: 'white',
                                              padding: '6px 12px',
                                              borderRadius: '6px',
                                              fontSize: '0.75rem',
                                              fontWeight: '600',
                                              backdropFilter: 'blur(4px)'
                                            }}>
                                              🔍 Click to view full size
                                            </div>
                                          </div>
                                          <a 
                                            href={att.data} 
                                            download={att.name}
                                            className="btn btn-secondary"
                                            style={{ 
                                              display: 'block',
                                              textAlign: 'center',
                                              fontSize: '0.9rem',
                                              padding: '0.75rem'
                                            }}
                                          >
                                            📥 Download Image
                                          </a>
                                        </div>
                                      ) : (
                                        <>
                                          <div style={{
                                            padding: '2.5rem 1rem',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            marginBottom: '1rem'
                                          }}>
                                            <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>📄</div>
                                            <div style={{ color: 'white', fontSize: '0.9rem', fontWeight: '600' }}>
                                              Document File
                                            </div>
                                          </div>
                                          <a 
                                            href={att.data} 
                                            download={att.name}
                                            className="btn btn-secondary"
                                            style={{ 
                                              display: 'block',
                                              textAlign: 'center',
                                              fontSize: '0.9rem',
                                              padding: '0.75rem'
                                            }}
                                          >
                                            📥 Download File
                                          </a>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                        } catch (e) {
                          return null;
                        }
                        return null;
                      })()}
                      <div className="detail-item">
                        <label>Created By:</label>
                        <span>{selectedTicket.reporterName}</span>
                      </div>
                    </>
                  ) : (
                    // User sees only specific fields
                    <>
                      <div className="detail-item">
                        <label>Date of Ticket:</label>
                        <span>{new Date(selectedTicket.dateOfTicket).toLocaleDateString()}</span>
                      </div>
                      <div className="detail-item">
                        <label>Ticket Number:</label>
                        <span>{selectedTicket.ticketNumber}</span>
                      </div>
                      <div className="detail-item">
                        <label>Reporter Name:</label>
                        <span>{selectedTicket.reporterName}</span>
                      </div>
                      <div className="detail-item">
                        <label>Contact Number:</label>
                        <span>{selectedTicket.contactNumber}</span>
                      </div>
                      <div className="detail-item">
                        <label>Branch:</label>
                        <span>{selectedTicket.branch}</span>
                      </div>
                      <div className="detail-item">
                        <label>Issue Type:</label>
                        <span>{selectedTicket.issueType}</span>
                      </div>
                      <div className="detail-item full-width">
                        <label>Reported Issue:</label>
                        <span style={{ whiteSpace: 'pre-wrap' }}>
                          {selectedTicket.reportedIssue && selectedTicket.reportedIssue.includes('--- SOLUTION ---') 
                            ? selectedTicket.reportedIssue.split('--- SOLUTION ---')[0].trim()
                            : selectedTicket.reportedIssue}
                        </span>
                      </div>
                      {selectedTicket.reportedIssue && selectedTicket.reportedIssue.includes('--- SOLUTION ---') && (
                        <div className="detail-item full-width" style={{
                          background: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
                          padding: '1.5rem',
                          borderRadius: '12px',
                          border: '2px solid #4ade80',
                          marginTop: '1rem'
                        }}>
                          <label style={{ 
                            fontSize: '1.1rem', 
                            fontWeight: '700', 
                            color: '#15803d',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '1rem'
                          }}>
                            <span style={{ fontSize: '1.5rem' }}>✅</span> Solution / Resolution
                          </label>
                          <div style={{ 
                            background: 'white',
                            padding: '1.25rem',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.6',
                            color: '#1f2937',
                            fontSize: '1rem'
                          }}>
                            {selectedTicket.reportedIssue.split('--- SOLUTION ---')[1].trim()}
                          </div>
                        </div>
                      )}
                      <div className="detail-item">
                        <label>Status:</label>
                        <span className={getStatusClass(selectedTicket.status)}>
                          {selectedTicket.status || 'Open'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <label>Priority:</label>
                        <span 
                          className={getPriorityClass(selectedTicket.priority)}
                          style={{ backgroundColor: getPriorityInfo(selectedTicket.priority).color }}
                        >
                          {getPriorityInfo(selectedTicket.priority).level} - {selectedTicket.priority || 'Low'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <label>Assigned To:</label>
                        <span>{selectedTicket.assignedTo}</span>
                      </div>
                      {selectedTicket.attachment && (() => {
                        try {
                          const attachments = JSON.parse(selectedTicket.attachment);
                          if (Array.isArray(attachments) && attachments.length > 0) {
                            return (
                              <div className="detail-item full-width">
                                <label style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem', display: 'block' }}>
                                  📎 Attachments ({attachments.length}/3)
                                </label>
                                <div style={{ 
                                  display: 'grid', 
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                  gap: '1.5rem'
                                }}>
                                  {attachments.map((att, index) => (
                                    <div key={index} style={{ 
                                      padding: '1.25rem', 
                                      border: '2px solid #e0e7ff', 
                                      borderRadius: '12px',
                                      backgroundColor: '#ffffff',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                      transition: 'all 0.3s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'translateY(-4px)';
                                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
                                      e.currentTarget.style.borderColor = '#818cf8';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                      e.currentTarget.style.borderColor = '#e0e7ff';
                                    }}>
                                      <div style={{ 
                                        fontWeight: '600', 
                                        marginBottom: '1rem', 
                                        color: '#4338ca',
                                        fontSize: '0.95rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {att.name}
                                      </div>
                                      {att.data && att.data.startsWith('data:image') ? (
                                        <div>
                                          <div 
                                            onClick={() => setEnlargedImage(att.data)}
                                            style={{ 
                                              cursor: 'pointer',
                                              position: 'relative',
                                              overflow: 'hidden',
                                              borderRadius: '8px',
                                              backgroundColor: '#f3f4f6',
                                              marginBottom: '1rem'
                                            }}
                                          >
                                            <img 
                                              src={att.data} 
                                              alt={att.name} 
                                              style={{ 
                                                width: '100%', 
                                                height: '200px',
                                                objectFit: 'cover',
                                                borderRadius: '8px',
                                                transition: 'transform 0.3s ease'
                                              }}
                                              onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                                              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                            />
                                            <div style={{
                                              position: 'absolute',
                                              bottom: '8px',
                                              right: '8px',
                                              background: 'rgba(0,0,0,0.75)',
                                              color: 'white',
                                              padding: '6px 12px',
                                              borderRadius: '6px',
                                              fontSize: '0.75rem',
                                              fontWeight: '600',
                                              backdropFilter: 'blur(4px)'
                                            }}>
                                              🔍 Click to view full size
                                            </div>
                                          </div>
                                          <a 
                                            href={att.data} 
                                            download={att.name}
                                            className="btn btn-secondary"
                                            style={{ 
                                              display: 'block',
                                              textAlign: 'center',
                                              fontSize: '0.9rem',
                                              padding: '0.75rem'
                                            }}
                                          >
                                            📥 Download Image
                                          </a>
                                        </div>
                                      ) : (
                                        <>
                                          <div style={{
                                            padding: '2.5rem 1rem',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            marginBottom: '1rem'
                                          }}>
                                            <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>📄</div>
                                            <div style={{ color: 'white', fontSize: '0.9rem', fontWeight: '600' }}>
                                              Document File
                                            </div>
                                          </div>
                                          <a 
                                            href={att.data} 
                                            download={att.name}
                                            className="btn btn-secondary"
                                            style={{ 
                                              display: 'block',
                                              textAlign: 'center',
                                              fontSize: '0.9rem',
                                              padding: '0.75rem'
                                            }}
                                          >
                                            📥 Download File
                                          </a>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                        } catch (e) {
                          return null;
                        }
                        return null;
                      })()}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="detail-actions">
              {editingInDetail ? (
                <>
                  <button className="btn btn-success" onClick={handleSaveInDetail}>
                    Save Changes
                  </button>
                  <button className="btn btn-secondary" onClick={handleCancelEditInDetail}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {(selectedTicket.status || 'Open') === 'Open' && (
                    <button className="btn btn-primary" onClick={handleStartWork}>
                      🚀 Start Work
                    </button>
                  )}
                  {(selectedTicket.status || 'Open') === 'In Progress' && (
                    <button className="btn btn-danger" onClick={() => setShowEndWorkPopup(true)}>
                      ✅ End Work
                    </button>
                  )}
                  <button className="btn" onClick={handleEditInDetail}>
                    Edit Ticket
                  </button>
                  <button className="btn btn-warning" onClick={handleBackToMain}>
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* End Work Popup */}
        {showEndWorkPopup && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowEndWorkPopup(false);
                setSolutionNotes('');
              }
            }}
          >
            <div 
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '2rem',
                maxWidth: '600px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                animation: 'slideIn 0.3s ease-out'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#1f2937', fontSize: '1.5rem', fontWeight: '700' }}>
                  ✅ Complete Work - {selectedTicket?.ticketNumber}
                </h2>
                <button
                  onClick={() => {
                    setShowEndWorkPopup(false);
                    setSolutionNotes('');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    padding: '0.5rem',
                    lineHeight: 1
                  }}
                >
                  ✕
                </button>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.75rem', 
                  fontWeight: '600',
                  color: '#374151',
                  fontSize: '1rem'
                }}>
                  How did you fix this issue? <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  value={solutionNotes}
                  onChange={(e) => setSolutionNotes(e.target.value)}
                  placeholder="Please describe the solution, steps taken, or actions performed to resolve this issue..."
                  style={{
                    width: '100%',
                    minHeight: '150px',
                    padding: '1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#818cf8'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
                <small style={{ color: '#6b7280', marginTop: '0.5rem', display: 'block' }}>
                  This information will be added to the ticket for future reference
                </small>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowEndWorkPopup(false);
                    setSolutionNotes('');
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '0.75rem 1.5rem' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndWork}
                  className="btn btn-danger"
                  style={{ padding: '0.75rem 1.5rem' }}
                >
                  ✅ Complete & Close Ticket
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Enlargement Modal */}
        {enlargedImage && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              cursor: 'zoom-out'
            }}
            onClick={() => setEnlargedImage(null)}
          >
            <button
              onClick={() => setEnlargedImage(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                fontSize: '2rem',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.2s',
                zIndex: 10001
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                e.target.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                e.target.style.transform = 'scale(1)';
              }}
            >
              ✕
            </button>
            <img
              src={enlargedImage}
              alt="Enlarged view"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="App" data-grm-disable="true">
      <div className="header">
        <div className="header-background"></div>
        <div className="container">
          <div className="header-content">
            <div className="header-left">
              <button 
                className="sidebar-toggle"
                onClick={toggleSidebar}
                title={sidebarHidden ? "Show Sidebar" : sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                <span className="toggle-icon">
                  {sidebarHidden ? '👁️' : sidebarCollapsed ? '👁️' : '☰'}
                </span>
              </button>
              <div className="logo-container">
                <div className="logo-image">
                  <img 
                    src="/Picture.png" 
                    alt="IT Ticket Logo" 
                    className="logo-icon"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'inline';
                    }}
                  />
                  <span className="logo-fallback">🎫</span>
            </div>
                <div className="logo">
                  <div className="logo-text-container">
                    <span className="logo-text">IT Ticket</span>
                    <span className="logo-subtitle">Management System</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="header-right">
            <div className="user-info">
                <div className="user-avatar">
                  <span className="user-initial">{(user.fullName || 'U').charAt(0).toUpperCase()}</span>
                </div>
                <div className="user-details">
                  <span className="user-name">Welcome, {user.fullName || 'User'}</span>
                  <span className="user-role">{user.role || 'user'}</span>
                </div>
              </div>
              <button 
                className="logout-btn" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleLogout();
                }}
                title="Logout"
              >
                <span className="logout-icon">🚪</span>
                <span className="logout-text">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="main-layout">
        {/* Sidebar Overlay for Mobile */}
        {!sidebarHidden && !sidebarCollapsed && (
          <div 
            className="sidebar-overlay active"
            onClick={() => setSidebarHidden(true)}
            style={{ display: window.innerWidth <= 768 ? 'block' : 'none' }}
          />
        )}
        
        {/* Sidebar Navigation */}
        {!sidebarHidden && (
          <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-content">
            {!sidebarCollapsed && (
              <div className="sidebar-header">
                <h3>Navigation</h3>
              </div>
            )}
            <nav className="sidebar-nav">
              <button 
                className={`sidebar-item ${currentPage === 'main' ? 'active' : ''}`}
                onClick={() => {
                  setCurrentPage('main');
                  setShowTicketDetail(false);
                  setSelectedTicket(null);
                  setEditingInDetail(false);
                  setShowTicketForm(false);
                  setEditingTicket(null);
                  // Reset URL to tickets page
                  window.history.pushState({}, '', '/tickets');
                }}
                title="Tickets"
              >
                <span className="sidebar-icon">🎫</span>
                {!sidebarCollapsed && (
                  <div className="sidebar-item-content">
                    <span className="sidebar-item-title">Tickets</span>
                    <span className="sidebar-item-desc">Manage tickets</span>
                  </div>
                )}
              </button>
              {user.role === 'admin' && (
                <button 
                  className={`sidebar-item ${currentPage === 'master-data' ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentPage('master-data');
                      setShowTicketDetail(false);
                      setSelectedTicket(null);
                      setEditingInDetail(false);
                      setShowTicketForm(false);
                      setEditingTicket(null);
                      // Fetch master data from database
                      fetchMasterData();
                      // Fetch users from database
                      fetchUsers();
                      // Reset URL to master data page
                      window.history.pushState({}, '', '/masterdata');
                    }}
                  title="Master Data"
                >
                  <span className="sidebar-icon">⚙️</span>
                  {!sidebarCollapsed && (
                    <div className="sidebar-item-content">
                      <span className="sidebar-item-title">Master Data</span>
                      <span className="sidebar-item-desc">System settings</span>
                    </div>
                  )}
                </button>
              )}
              <button 
                className={`sidebar-item ${currentPage === 'profile' ? 'active' : ''}`}
                onClick={() => {
                  setCurrentPage('profile');
                  setShowTicketDetail(false);
                  setSelectedTicket(null);
                  setEditingInDetail(false);
                  setShowTicketForm(false);
                  setEditingTicket(null);
                  // Fetch latest user data from database
                  fetchUserProfile();
                  // Reset URL to profile page
                  window.history.pushState({}, '', '/profile');
                }}
                title="Profile"
              >
                <span className="sidebar-icon">👤</span>
                {!sidebarCollapsed && (
                  <div className="sidebar-item-content">
                    <span className="sidebar-item-title">Profile</span>
                    <span className="sidebar-item-desc">Account settings</span>
                  </div>
                )}
              </button>
            </nav>
          </div>
        </div>
        )}

        <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${sidebarHidden ? 'sidebar-hidden' : ''}`}>
          <div className="container">
        {/* Master Data Page */}
        {currentPage === 'master-data' ? (
          <div className="master-data-page">
            <div className="page-header">
              <h2>Master Data Management</h2>
              <div className="master-data-stats">
                <div className="stat-card">
                  <span className="stat-number">{issueTypes.length}</span>
                  <span className="stat-label">Issue Types</span>
                </div>
              </div>
            </div>

            {/* Master Data Tabs */}
            <div className="master-data-tabs">
              <div className="tab-buttons">
                <button 
                  className={`tab-button ${activeMasterDataTab === 'issue-types' ? 'active' : ''}`}
                  onClick={() => setActiveMasterDataTab('issue-types')}
                >
                  Issue Types
                </button>
                <button 
                  className={`tab-button ${activeMasterDataTab === 'users' ? 'active' : ''}`}
                  onClick={() => setActiveMasterDataTab('users')}
                >
                  Users
                </button>
              </div>

              {/* Issue Types Tab */}
              {activeMasterDataTab === 'issue-types' && (
                <div className="tab-content">
                  <div className="tab-header">
                    <h3>Issue Types</h3>
                    <div className="tab-actions">
                      <input 
                        type="text" 
                        placeholder="Search issue types..." 
                        className="search-input"
                        onChange={(e) => {
                          const searchTerm = e.target.value.toLowerCase();
                          const filtered = issueTypes.filter(item => 
                            item.name.toLowerCase().includes(searchTerm) ||
                            item.description.toLowerCase().includes(searchTerm)
                          );
                          // You could add local filtering state here
                        }}
                      />
                      <button 
                        className="btn btn-secondary" 
                        onClick={fetchMasterData}
                        title="Refresh Data"
                      >
                        🔄 Refresh
                      </button>
                    <button 
                      className="btn btn-primary" 
                        onClick={() => {
                          setEditingIssueType(null);
                          setIssueTypeFormData({ name: '', description: '' });
                          setShowIssueTypeForm(true);
                        }}
                      >
                        + Add Issue Type
                    </button>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-body">
                      {issueTypes.length === 0 ? (
                        <div className="empty-state">
                          <p>No issue types found. Click "Add Issue Type" to create one.</p>
                        </div>
                      ) : (
                        <div className="table-container">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Description</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(issueTypes || []).map(issueType => (
                                <tr key={issueType.id}>
                                  <td>{issueType.name}</td>
                                  <td>{issueType.description}</td>
                                  <td>
                                    <button 
                                      className="btn btn-sm btn-primary"
                                      onClick={() => handleEditIssueType(issueType)}
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      className="btn btn-sm btn-danger"
                                      onClick={() => handleDeleteIssueType(issueType.id)}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Issue Type Form */}
                  {showIssueTypeForm && (
                    <div className="card">
                      <div className="card-header">
                        <h3>{editingIssueType ? 'Edit Issue Type' : 'Add New Issue Type'}</h3>
                      </div>
                      <div className="card-body">
                        <form onSubmit={handleIssueTypeSubmit}>
                          <div className="form-group">
                            <label htmlFor="name">Name:</label>
                            <input
                              type="text"
                              id="name"
                              name="name"
                              value={issueTypeFormData.name}
                              onChange={handleIssueTypeInputChange}
                              required
                              placeholder="Enter issue type name"
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="description">Description:</label>
                            <textarea
                              id="description"
                              name="description"
                              value={issueTypeFormData.description}
                              onChange={handleIssueTypeInputChange}
                              required
                              placeholder="Enter issue type description"
                              rows="3"
                            />
                          </div>

                          <div className="form-actions">
                            <button type="submit" className="btn btn-success">
                              {editingIssueType ? 'Update Issue Type' : 'Create Issue Type'}
                            </button>
                            <button 
                              type="button" 
                              className="btn btn-secondary"
                              onClick={handleCancelIssueType}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}





              {/* Users Tab */}
              {activeMasterDataTab === 'users' && (
                <div className="tab-content">
                  <div className="tab-header">
                    <h3>Users</h3>
                    <div className="tab-actions">
                            <input
                              type="text"
                        placeholder="Search users..." 
                        className="search-input"
                      />
                            <button 
                              className="btn btn-secondary"
                        onClick={fetchUsers}
                        title="Refresh Data"
                            >
                        🔄 Refresh
                            </button>
                    <button 
                      className="btn btn-primary" 
                        onClick={() => {
                          setEditingUser(null);
                          setUserFormData({ username: '', fullName: '', email: '', role: 'user', department: '', phone: '', password: '' });
                          setShowUserForm(true);
                        }}
                      >
                        + Add User
                    </button>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-body">
                      {users.length === 0 ? (
                        <div className="empty-state">
                          <p>No users found. Click "Add User" to create one.</p>
                        </div>
                      ) : (
                        <div className="table-container">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Username</th>
                                <th>Full Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Department</th>
                                <th>Phone</th>
                                <th>Status</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(users || []).map(user => (
                                <tr key={user.id}>
                                  <td>{user.username}</td>
                                  <td>{user.fullName}</td>
                                  <td>{user.email}</td>
                                  <td>
                                    <span className={`role-badge role-${user.role}`}>
                                      {user.role}
                                    </span>
                                  </td>
                                  <td>{user.department}</td>
                                  <td>{user.phone || '-'}</td>
                                  <td>
                                    <span className={`status-badge ${user.isActive ? 'status-open' : 'status-closed'}`}>
                                      {user.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td>
                                    <button 
                                      className="btn btn-sm btn-primary"
                                      onClick={() => handleEditUser(user)}
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      className="btn btn-sm btn-danger"
                                      onClick={() => handleDeleteUser(user.id)}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* User Form */}
                  {showUserForm && (
                    <div className="card">
                      <div className="card-header">
                        <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
                      </div>
                      <div className="card-body">
                        <form onSubmit={handleUserSubmit}>
                          <div className="form-group">
                            <label htmlFor="userUsername">Username:</label>
                            <input
                              type="text"
                              id="userUsername"
                              name="username"
                              value={userFormData.username}
                              onChange={handleUserInputChange}
                              required
                              placeholder="Enter username"
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="userFullName">Full Name:</label>
                            <input
                              type="text"
                              id="userFullName"
                              name="fullName"
                              value={userFormData.fullName}
                              onChange={handleUserInputChange}
                              required
                              placeholder="Enter full name"
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="userEmail">Email:</label>
                            <input
                              type="email"
                              id="userEmail"
                              name="email"
                              value={userFormData.email}
                              onChange={handleUserInputChange}
                              required
                              placeholder="Enter email address"
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="userRole">Role:</label>
                            <select
                              id="userRole"
                              name="role"
                              value={userFormData.role}
                              onChange={handleUserInputChange}
                              required
                            >
                              <option value="user">User</option>
                              <option value="technician">Technician</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label htmlFor="userDepartment">Department:</label>
                            <input
                              type="text"
                              id="userDepartment"
                              name="department"
                              value={userFormData.department}
                              onChange={handleUserInputChange}
                              required
                              placeholder="Enter department"
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="userPhone">Phone:</label>
                            <input
                              type="tel"
                              id="userPhone"
                              name="phone"
                              value={userFormData.phone}
                              onChange={handleUserInputChange}
                              placeholder="Enter phone number"
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="userPassword">Password:</label>
                            <input
                              type="password"
                              id="userPassword"
                              name="password"
                              value={userFormData.password}
                              onChange={handleUserInputChange}
                              placeholder="Enter password"
                              required
                            />
                          </div>

                          <div className="form-actions">
                            <button type="submit" className="btn btn-success">
                              {editingUser ? 'Update User' : 'Create User'}
                            </button>
                            <button 
                              type="button" 
                              className="btn btn-secondary"
                              onClick={handleCancelUser}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : currentPage === 'create' ? (
          /* Create New Ticket Page */
          <div className="create-page">
            <div className="page-header">
              <h2>Create New Ticket</h2>
              <button className="btn btn-secondary" onClick={() => {
                window.history.pushState({}, '', '/');
                setCurrentPage('main');
                setShowTicketForm(false);
                setEditingTicket(null);
              }}>
                ← Back to Main
              </button>
            </div>
            
            <div className="ticket-form">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="reporterName">Reporter Name:</label>
                  <input
                    type="text"
                    id="reporterName"
                    name="reporterName"
                    value={formData.reporterName}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="contactNumber">Contact Number:</label>
                  <input
                    type="tel"
                    id="contactNumber"
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="branch">Branch:</label>
                  <input
                    type="text"
                    placeholder="🔍 Search branches by name or code..."
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    style={{ marginBottom: '0.5rem' }}
                  />
                  <select
                    id="branch"
                    name="branch"
                    value={formData.branch}
                    onChange={(e) => {
                      handleInputChange(e);
                      setBranchSearch('');
                    }}
                    required
                    size={branchSearch ? Math.min(10, getFilteredBranches().length + 1) : 1}
                  >
                    <option value="">-- Select a branch --</option>
                    {getFilteredBranches().map((branch) => (
                      <option key={branch.id} value={branch.name}>
                        {branch.name} {branch.code ? `(${branch.code})` : ''}
                      </option>
                    ))}
                  </select>
                  {branchSearch && getFilteredBranches().length === 0 && (
                    <small style={{ color: '#dc2626', marginTop: '0.25rem', display: 'block' }}>
                      No branches match "{branchSearch}"
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="issueType">Issue Type:</label>
                  <select
                    id="issueType"
                    name="issueType"
                    value={formData.issueType}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Issue Type</option>
                    {(issueTypes || []).map(issueType => (
                      <option key={issueType.id} value={issueType.name}>
                        {issueType.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="priority">Priority:</label>
                  <select
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Priority</option>
                    {priorities.map(priority => (
                      <option key={priority.id} value={priority.name}>
                        {priority.level} - {priority.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="reportedIssue">Reported Issue:</label>
                  <textarea
                    id="reportedIssue"
                    name="reportedIssue"
                    value={formData.reportedIssue}
                    onChange={handleInputChange}
                    required
                    rows="4"
                    placeholder="Describe the issue in detail"
                  />
                </div>


                <div className="form-group">
                  <label htmlFor="dateOfTicket">Date of Ticket:</label>
                  <input
                    type="date"
                    id="dateOfTicket"
                    name="dateOfTicket"
                    value={formData.dateOfTicket}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="attachment">Attachments (Max 3):</label>
                  <div className="file-upload-container">
                    {selectedFiles.length < 3 && (
                      <>
                        <input
                          type="file"
                          id="attachment"
                          name="attachment"
                          onChange={handleFileChange}
                          accept="image/*,.pdf,.doc,.docx,.txt"
                          className="file-input"
                          multiple
                        />
                        <label htmlFor="attachment" className="file-input-label">
                          <span className="file-input-icon">📎</span>
                          Add File ({selectedFiles.length}/3)
                        </label>
                      </>
                    )}
                    {selectedFiles.length >= 3 && (
                      <div style={{ color: '#16a34a', fontWeight: '500', padding: '0.5rem' }}>
                        ✓ Maximum files reached (3/3)
                      </div>
                    )}
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="file-preview">
                        <span className="file-name">{file.name}</span>
                        <button 
                          type="button" 
                          className="remove-file-btn"
                          onClick={() => handleRemoveFile(index)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>


                <div>
                  <button type="submit" className="btn btn-success">
                    Create Ticket
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    window.history.pushState({}, '', '/');
                    setCurrentPage('main');
                    setShowTicketForm(false);
                    setEditingTicket(null);
                  }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : currentPage === 'profile' ? (
          /* Profile Page */
          <div className="profile-page">
            <div className="page-header">
              <h2>User Profile</h2>
              <button className="btn btn-secondary" onClick={() => {
                window.history.pushState({}, '', '/');
                setCurrentPage('main');
              }}>
                ← Back to Main
              </button>
            </div>
            
            <div className="profile-content">
              <div className="profile-card">
                <div className="profile-header">
                  <div className="profile-avatar-large">
                    <span className="profile-initial-large">{(user.fullName || 'U').charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="profile-info">
                    <h3>{user.fullName}</h3>
                    <p className="profile-role">{user.role}</p>
                    <p className="profile-email">{user.email}</p>
                  </div>
                </div>
                
                {!editingProfile ? (
                  <div className="profile-details">
                    <div className="profile-section">
                      <h4>Personal Information</h4>
                      <div className="profile-grid">
                        <div className="profile-item">
                          <label>Full Name:</label>
                          <span>{user.fullName}</span>
                        </div>
                        <div className="profile-item">
                          <label>Email:</label>
                          <span>{user.email}</span>
                        </div>
                        <div className="profile-item">
                          <label>Role:</label>
                          <span className="profile-role-badge">{user.role}</span>
                        </div>
                        <div className="profile-item">
                          <label>Department:</label>
                          <span>{user.department || 'Not specified'}</span>
                        </div>
                        <div className="profile-item">
                          <label>Phone:</label>
                          <span>{user.phone || 'Not specified'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="profile-actions">
                      <button className="btn btn-primary" onClick={handleEditProfile}>
                        Edit Profile
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="profile-edit-form">
                    <form onSubmit={handleUpdateProfile}>
                      <div className="form-section">
                        <h4>Personal Information</h4>
                        <div className="form-grid">
                          <div className="form-group">
                            <label htmlFor="fullName">Full Name:</label>
                            <input
                              type="text"
                              id="fullName"
                              name="fullName"
                              value={profileFormData.fullName}
                              onChange={handleProfileInputChange}
                              required
                              placeholder="Enter your full name"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label htmlFor="email">Email:</label>
                            <input
                              type="email"
                              id="email"
                              name="email"
                              value={profileFormData.email}
                              onChange={handleProfileInputChange}
                              required
                              placeholder="Enter your email"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label htmlFor="role">Role:</label>
                            <select
                              id="role"
                              name="role"
                              value={profileFormData.role}
                              onChange={handleProfileInputChange}
                              required
                            >
                              <option value="user">User</option>
                              <option value="technician">Technician</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                          
                          <div className="form-group">
                            <label htmlFor="department">Department:</label>
                            <input
                              type="text"
                              id="department"
                              name="department"
                              value={profileFormData.department}
                              onChange={handleProfileInputChange}
                              placeholder="Enter your department"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label htmlFor="phone">Phone:</label>
                            <input
                              type="tel"
                              id="phone"
                              name="phone"
                              value={profileFormData.phone}
                              onChange={handleProfileInputChange}
                              placeholder="Enter your phone number"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="form-section">
                        <h4>Change Password</h4>
                        <div className="form-grid">
                          <div className="form-group">
                            <label htmlFor="currentPassword">Current Password:</label>
                            <input
                              type="password"
                              id="currentPassword"
                              name="currentPassword"
                              value={profileFormData.currentPassword}
                              onChange={handleProfileInputChange}
                              placeholder="Enter current password"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label htmlFor="newPassword">New Password:</label>
                            <input
                              type="password"
                              id="newPassword"
                              name="newPassword"
                              value={profileFormData.newPassword}
                              onChange={handleProfileInputChange}
                              placeholder="Enter new password"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm New Password:</label>
                            <input
                              type="password"
                              id="confirmPassword"
                              name="confirmPassword"
                              value={profileFormData.confirmPassword}
                              onChange={handleProfileInputChange}
                              placeholder="Confirm new password"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="form-actions">
                        <button type="submit" className="btn btn-success">
                          Update Profile
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={handleCancelEditProfile}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : currentPage === 'main' && !showTicketForm && !editingTicket ? (
          <div className="main-page">
            <div className="page-header">
              <h2>IT Ticket Management System</h2>
              <button className="btn btn-primary btn-large" onClick={handleOpenTicket}>
                Open New Ticket
              </button>
            </div>
            
            <div className="tickets-table-container">
              {tickets.length === 0 ? (
                <div className="empty-state">
                  <h3>No tickets found</h3>
                  <p>Click "Open New Ticket" to create your first ticket</p>
                </div>
              ) : (
                <div className="card">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date of Ticket</th>
                        <th>Number of Ticket</th>
                        <th>Report Issue</th>
                        <th>Status</th>
                        <th>Assigned To</th>
                        <th>Created By</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tickets || []).map(ticket => (
                        <tr key={ticket.id}>
                          <td>{new Date(ticket.dateOfTicket).toLocaleDateString()}</td>
                          <td>{ticket.ticketNumber}</td>
                          <td 
                            className="clickable-issue"
                            onClick={() => handleViewTicket(ticket)}
                            style={{ cursor: 'pointer', color: '#dc2626', textDecoration: 'underline' }}
                          >
                            {ticket.reportedIssue}
                          </td>
                          <td>
                            <span className={getStatusClass(ticket.status)}>
                              {ticket.status || 'Open'}
                            </span>
                          </td>
                          <td>{ticket.assignedTo}</td>
                          <td>{ticket.reporterName}</td>
                          <td>
                            {/* Show edit button if user is admin OR if user created/assigned to this ticket */}
                            {(user.role === 'admin' || ticket.CreatedBy === (user.fullName || user.username) || ticket.AssignedTo === (user.fullName || user.username)) && (
                                <button 
                                  className="btn btn-xs" 
                                  onClick={() => handleEdit(ticket)}
                                >
                                  Edit
                                </button>
                            )}
                            {/* Show delete button only for admin users */}
                            {user.role === 'admin' && (
                                <button 
                                  className="btn btn-danger btn-xs" 
                                  onClick={() => handleDelete(ticket.id)}
                                >
                                  Delete
                                </button>
                            )}
                            {/* Show view only for users who can't edit this ticket */}
                            {user.role === 'user' && ticket.CreatedBy !== (user.fullName || user.username) && ticket.AssignedTo !== (user.fullName || user.username) && (
                              <span className="view-only">View Only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Ticket Form */
          <div className="ticket-form">
            <h2>{editingTicket ? 'Edit Ticket' : 'Create New Ticket'}</h2>
            <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="reporterName">Reporter Name:</label>
              <input
                type="text"
                id="reporterName"
                name="reporterName"
                value={formData.reporterName}
                onChange={handleInputChange}
                required
                placeholder="Enter your full name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="contactNumber">Contact Number:</label>
              <input
                type="tel"
                id="contactNumber"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleInputChange}
                required
                placeholder="Enter your phone number"
              />
            </div>

            <div className="form-group">
              <label htmlFor="branch">Branch:</label>
              <input
                type="text"
                placeholder="🔍 Search branches by name or code..."
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                style={{ marginBottom: '0.5rem' }}
              />
              <select
                id="branchModal"
                name="branch"
                value={formData.branch}
                onChange={(e) => {
                  handleInputChange(e);
                  setBranchSearch('');
                }}
                required
                size={branchSearch ? Math.min(10, getFilteredBranches().length + 1) : 1}
              >
                <option value="">-- Select a branch --</option>
                {getFilteredBranches().map((branch) => (
                  <option key={branch.id} value={branch.name}>
                    {branch.name} {branch.code ? `(${branch.code})` : ''}
                  </option>
                ))}
              </select>
              {branchSearch && getFilteredBranches().length === 0 && (
                <small style={{ color: '#dc2626', marginTop: '0.25rem', display: 'block' }}>
                  No branches match "{branchSearch}"
                </small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="issueType">Issue Type:</label>
              <select
                id="issueType"
                name="issueType"
                value={formData.issueType}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Issue Type</option>
                {(issueTypes || []).map(issueType => (
                  <option key={issueType.id} value={issueType.name}>
                    {issueType.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="reportedIssue">Reported Issue:</label>
              <textarea
                id="reportedIssue"
                name="reportedIssue"
                value={formData.reportedIssue}
                onChange={handleInputChange}
                required
                placeholder="Describe the issue in detail..."
                rows="4"
              />
            </div>


            <div className="form-group">
              <label htmlFor="dateOfTicket">Date of Ticket:</label>
              <input
                type="date"
                id="dateOfTicket"
                name="dateOfTicket"
                value={formData.dateOfTicket}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="priority">Priority:</label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Priority</option>
                {priorities.map(priority => (
                  <option key={priority.id} value={priority.name}>
                    {priority.level} - {priority.name}
                  </option>
                ))}
              </select>
            </div>

            {editingTicket && (
              <>
                <div className="form-group">
                  <label htmlFor="status">Status:</label>
                  <input
                    type="text"
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    placeholder="Enter status (e.g., Open, In Progress, Resolved, Closed)"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="assignedTo">Assigned To:</label>
                  <select
                    id="assignedTo"
                    name="assignedTo"
                    value={formData.assignedTo}
                    onChange={handleInputChange}
                  >
                    <option value="">Select User</option>
                    {(users || []).map(user => (
                      <option key={user.id} value={user.fullName}>
                        {user.fullName} ({user.role})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <button type="submit" className="btn btn-success">
                {editingTicket ? 'Update Ticket' : 'Create Ticket'}
              </button>
              <button type="button" className="btn btn-warning" onClick={handleCancelEdit}>
                Cancel
              </button>
            </div>
          </form>
        </div>
        )}
          </div>
        </div>
      </div>

      {/* Beautiful Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-icon ${modalType}`}>
              {modalType === 'success' ? (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#10B981"/>
                  <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#EF4444"/>
                  <path d="M15 9l-6 6M9 9l6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <h3 className={`modal-title ${modalType}`}>
              {modalType === 'success' ? 'Success!' : 'Error!'}
            </h3>
            <p className="modal-message">{modalMessage}</p>
            <button className={`modal-button ${modalType}`} onClick={closeModal}>
              {modalType === 'success' ? 'Continue' : 'Try Again'}
            </button>
          </div>
        </div>
      )}

      {/* Image Enlargement Modal */}
      {enlargedImage && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            cursor: 'zoom-out'
          }}
          onClick={() => setEnlargedImage(null)}
        >
          <button
            onClick={() => setEnlargedImage(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              fontSize: '2rem',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.3)';
              e.target.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)';
              e.target.style.transform = 'scale(1)';
            }}
          >
            ✕
          </button>
          <img
            src={enlargedImage}
            alt="Enlarged view"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default App;
