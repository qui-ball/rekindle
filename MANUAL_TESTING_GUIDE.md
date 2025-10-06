# Manual Testing Guide: Photo Management System (Tasks 1.1 - 2.3)

## Overview
This guide covers manual testing of the photo management system components we've built from tasks 1.1 to 2.3, including the PhotoManagementContainer, PhotoGallery, and PhotoStatusIndicator components.

## Prerequisites
1. **Backend Running**: Ensure the backend is running with PostgreSQL RDS
2. **Frontend Running**: Start the Next.js development server
3. **Database Setup**: Ensure you have some test photos in the database

## Starting the Application

### 1. Start Backend
```bash
cd backend
RUN_INTEGRATION_TESTS=1 uv run --env-file .env python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start Frontend
```bash
cd frontend
npm run dev
```

### 3. Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Manual Testing Scenarios

### Test 1: Photo Management Container Loading
**Objective**: Verify the main container loads and displays photos correctly

**Steps**:
1. Navigate to the photo management page
2. Check that the loading state appears initially
3. Verify photos load and display in a grid layout
4. Check that credit balance is displayed at the top

**Expected Results**:
- ✅ Loading spinner shows "Loading your photos..."
- ✅ Photos display in responsive grid (2-4 columns based on screen size)
- ✅ Credit balance shows with subscription and top-up credits
- ✅ No console errors

### Test 2: Photo Gallery Functionality
**Objective**: Test the PhotoGallery component features

**Steps**:
1. **Grid Layout**: Verify photos display in proper grid
2. **Photo Thumbnails**: Check that thumbnails are properly sized and clickable
3. **Status Overlays**: Look for status indicators on photos (ready, processing, completed, failed)
4. **Infinite Scroll**: Scroll to bottom to test "Load More" functionality
5. **Pull-to-Refresh**: On mobile, test pull-to-refresh gesture

**Expected Results**:
- ✅ Responsive grid layout (2 columns on mobile, 3-4 on desktop)
- ✅ Thumbnails are touch-optimized and clickable
- ✅ Status indicators show correct states with animations
- ✅ Infinite scroll loads more photos smoothly
- ✅ Pull-to-refresh works on mobile devices

### Test 3: Photo Status Indicators
**Objective**: Test the PhotoStatusIndicator component

**Steps**:
1. **Ready Status**: Look for photos with "ready" status (green indicator)
2. **Processing Status**: Check photos with "processing" status (orange with progress)
3. **Completed Status**: Verify "completed" status (green checkmark)
4. **Failed Status**: Check "failed" status (red with retry button)
5. **Animations**: Verify status animations (pulse, spin, shake)

**Expected Results**:
- ✅ Ready: Green indicator with "Ready" text
- ✅ Processing: Orange indicator with progress bar and estimated time
- ✅ Completed: Green checkmark with "Completed" text
- ✅ Failed: Red indicator with shake animation and retry button
- ✅ Smooth animations

### Test 4: Photo Detail Drawer
**Objective**: Test the photo detail drawer functionality

**Steps**:
1. Click on any photo thumbnail
2. Verify the drawer opens from the right side
3. Check that photo details are displayed
4. Test the close button (X)
5. Test clicking outside the drawer to close

**Expected Results**:
- ✅ Drawer slides in smoothly from the right
- ✅ Photo details are clearly displayed
- ✅ Close button works
- ✅ Clicking outside closes the drawer
- ✅ Smooth animations

### Test 5: Error Handling
**Objective**: Test error handling and recovery

**Steps**:
1. **Network Error**: Disconnect internet and try to load photos
2. **API Error**: Check console for any API errors
3. **Retry Functionality**: Test retry buttons on failed operations
4. **Error Messages**: Verify user-friendly error messages

**Expected Results**:
- ✅ Network errors show retry options
- ✅ API errors are handled gracefully
- ✅ Retry buttons work correctly
- ✅ Error messages are user-friendly

### Test 6: Mobile Responsiveness
**Objective**: Test mobile-specific features

**Steps**:
1. **Touch Interactions**: Test touch gestures on mobile
2. **Responsive Layout**: Check layout on different screen sizes
3. **Pull-to-Refresh**: Test pull-to-refresh gesture
4. **Touch Targets**: Verify buttons are touch-friendly (44px minimum)

**Expected Results**:
- ✅ Touch interactions work smoothly
- ✅ Layout adapts to screen size
- ✅ Pull-to-refresh works
- ✅ All buttons are touch-friendly

### Test 7: Credit Balance Display
**Objective**: Test credit balance functionality

**Steps**:
1. Check credit balance display at the top
2. Verify subscription credits vs top-up credits
3. Test low credit warning (if applicable)
4. Test credit purchase flow (if implemented)

**Expected Results**:
- ✅ Credit balance shows both subscription and top-up credits
- ✅ Low credit warnings appear when appropriate
- ✅ Credit purchase flow works (if implemented)

## Browser Testing

### Desktop Browsers
- **Chrome**: Latest version
- **Firefox**: Latest version  
- **Safari**: Latest version
- **Edge**: Latest version

### Mobile Browsers
- **iOS Safari**: Latest version
- **Chrome Mobile**: Latest version
- **Samsung Internet**: Latest version

## Performance Testing

### Load Testing
1. **Large Photo Sets**: Test with 100+ photos
2. **Infinite Scroll**: Test loading many pages
3. **Memory Usage**: Monitor browser memory usage
4. **Network Requests**: Check for excessive API calls

### Expected Performance
- ✅ Initial load < 3 seconds
- ✅ Photo thumbnails load progressively
- ✅ Smooth scrolling with 100+ photos
- ✅ Memory usage stays reasonable

## Common Issues and Solutions

### Issue 1: Photos Not Loading
**Symptoms**: Loading spinner never stops, no photos display
**Solutions**:
- Check backend API is running
- Verify database connection
- Check browser console for errors
- Test API endpoints directly

### Issue 2: Status Indicators Not Showing
**Symptoms**: Photos display without status overlays
**Solutions**:
- Check PhotoStatusIndicator component is imported
- Verify photo status data from API
- Check CSS animations are working

### Issue 3: Mobile Touch Issues
**Symptoms**: Touch interactions not working on mobile
**Solutions**:
- Check touch event handlers
- Verify CSS touch-action properties
- Test on actual mobile device

## Test Data Setup

### Creating Test Photos
If you need test photos, you can:

1. **Use the API directly**:
```bash
curl -X POST "http://localhost:8000/api/v1/photos" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "filename": "test-photo.jpg",
    "status": "uploaded"
  }'
```

2. **Use the database directly**:
```sql
INSERT INTO photos (id, user_id, filename, status, created_at) 
VALUES ('test-1', 'test-user', 'test1.jpg', 'ready', NOW());
```

## Reporting Issues

When reporting issues, include:
1. **Browser/Device**: Chrome 120, iPhone 14, etc.
2. **Steps to Reproduce**: Exact steps taken
3. **Expected vs Actual**: What should happen vs what happened
4. **Console Errors**: Any JavaScript errors
5. **Network Tab**: Any failed API requests
6. **Screenshots**: Visual evidence of the issue

## Success Criteria

The photo management system is working correctly if:
- ✅ All photos load and display properly
- ✅ Status indicators show correct states with animations
- ✅ Mobile responsiveness works on all screen sizes
- ✅ Error handling provides good user experience
- ✅ Performance is smooth with large photo sets
- ✅ All user interactions work as expected

## Next Steps

After manual testing is complete:
1. **Report any issues** found during testing
2. **Document any missing features** that should be implemented
3. **Provide feedback** on user experience
4. **Plan next phase** of development based on test results
